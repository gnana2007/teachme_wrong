from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.agents import agents
from app.api.deps import current_user, require_role
from app.config import settings
from app.database.repo import repo, uid, now
from app.ingestion import extract
from app.rag.store import vector_store
from app.schemas.models import (AddStudent, CourseCreate, CustomConceptIn, MessageIn, SessionCreate, SignupIn, TransferAnswerIn)
from app.services import analytics, session_service as svc

router = APIRouter()


# ---------- auth ----------
@router.post("/auth/signup")
def signup(body: SignupIn):
    """Dev signup. In production, Supabase Auth creates the user. In dev, returns existing user if email is already registered."""
    email = body.email.strip().lower()
    existing = next((u for u in repo.users.values() if u["email"].lower() == email), None)
    if existing:
        return existing
    return repo.add_user(body.name.strip() or "Student", email, body.role)


@router.post("/auth/login")
def login(body: dict):
    email = (body.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(400, "Email is required")
    u = next((u for u in repo.users.values() if u["email"].lower() == email), None)
    if not u:
        name = email.split("@")[0].replace(".", " ").title() or "Student"
        u = repo.add_user(name, email, "student")
    return u


@router.get("/me")
def me(user=Depends(current_user)):
    return user


# ---------- concepts ----------
@router.get("/concepts")
def list_concepts(q: str = "", subject: str = "", user=Depends(current_user)):
    out = []
    q_str = q.strip().lower()
    subj_str = subject.strip().lower()
    for c in repo.concepts.values():
        if c.get("owner_id") not in (None, user["id"]):
            continue
        if q_str and (q_str not in c["name"].lower() and q_str not in c.get("description", "").lower()):
            continue
        if subj_str and subj_str != c.get("subject", "").strip().lower():
            continue
        out.append({**c, "node_count": len(repo.concept_nodes(c["id"]))})
    return out


@router.get("/subjects")
def subjects():
    return ["Computer Science", "Mathematics", "Physics", "Chemistry", "Biology", "Economics", "Engineering", "General Knowledge"]


@router.get("/concepts/{concept_id}")
def concept_detail(concept_id: str, user=Depends(current_user)):
    c = repo.concepts.get(concept_id)
    if not c:
        raise HTTPException(404, "Concept not found")
    m = repo.student_mastery(user["id"], concept_id)
    nodes = [{"key": n["key"], "name": n["name"], "description": n["description"], "parent": n["parent_key"],
              "score": round(m.get(n["key"], {}).get("score", 0), 2)} for n in repo.concept_nodes(concept_id)]
    return {**c, "nodes": nodes}


async def _build_concept(user, name, subject, description, material_id) -> dict:
    source = (repo.materials.get(material_id) or {}).get("extracted_text", "") if material_id else ""
    key = uid()
    analysis = await agents.analyze_concept(key, name, source)
    nodes = analysis["nodes"]
    mis = await agents.generate_validated_misconceptions(key, name, nodes, source)
    if not mis:
        raise HTTPException(422, "Could not generate validated misconceptions from this material. Try a longer or clearer source.")
    c = repo.add_concept(name, subject, description or f"Custom concept: {name}", 2, nodes, mis, owner_id=user["id"], id=key)
    return {"concept": c, "progress": {"extracted_content": bool(source), "concepts": len(nodes),
                                        "prerequisite_relationships": len(analysis.get("relationships", [])),
                                        "misconceptions": len(mis)}}


@router.post("/concepts/custom")
async def custom_concept(body: CustomConceptIn, user=Depends(current_user)):
    return await _build_concept(user, body.name, body.subject, body.description, body.material_id)


# ---------- materials ----------
@router.post("/materials/upload")
async def upload_material(file: UploadFile = File(...), user=Depends(current_user)):
    data = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    try:
        kind = extract.validate(file.content_type or "", data, settings.max_upload_mb)
        text = extract.extract_text(kind, data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    mid = uid()
    chunks = vector_store.add(mid, text)
    repo.materials[mid] = {"id": mid, "user_id": user["id"], "filename": file.filename, "extracted_text": text, "chunks": chunks, "created_at": now()}
    return {"id": mid, "filename": file.filename, "characters": len(text), "chunks": chunks}


@router.post("/materials/{material_id}/analyze")
async def analyze_material(material_id: str, name: str = Form(...), subject: str = Form("General Knowledge"), user=Depends(current_user)):
    mat = repo.materials.get(material_id)
    if not mat or mat["user_id"] != user["id"]:
        raise HTTPException(404, "Material not found")
    return await _build_concept(user, name, subject, "", material_id)


# ---------- sessions ----------
@router.post("/sessions")
async def create_session(body: SessionCreate, user=Depends(current_user)):
    require_role(user, "student")
    return await svc.create_session(user, body.concept_id, body.material_id)


@router.get("/sessions/{session_id}")
def get_session(session_id: str, user=Depends(current_user)):
    return svc.view(svc.get_owned(session_id, user))


@router.post("/sessions/{session_id}/message")
async def post_message(session_id: str, body: MessageIn, user=Depends(current_user)):
    return await svc.handle_message(svc.get_owned(session_id, user), body.input)


@router.get("/sessions/{session_id}/hint")
async def get_hint(session_id: str, user=Depends(current_user)):
    return await svc.get_hint(svc.get_owned(session_id, user))



@router.post("/sessions/{session_id}/transfer-test")
async def transfer_test(session_id: str, user=Depends(current_user)):
    return await svc.start_transfer(svc.get_owned(session_id, user))


@router.post("/sessions/{session_id}/transfer-test/answer")
async def transfer_answer(session_id: str, body: TransferAnswerIn, user=Depends(current_user)):
    return await svc.answer_transfer(svc.get_owned(session_id, user), body.input)


@router.post("/sessions/{session_id}/evaluate")
async def evaluate_session(session_id: str, user=Depends(current_user)):
    """Finalize now (skips the transfer test) or return the existing final result."""
    s = svc.get_owned(session_id, user)
    return s.get("final") or await svc.finalize(s, None)


# ---------- students ----------
def _self_or_prof(user, student_id):
    if user["id"] == student_id:
        return
    if user["role"] == "professor" and any(c["professor_id"] == user["id"] and (c["id"], student_id) in repo.course_students
                                           for c in repo.courses.values()):
        return
    raise HTTPException(403, "Not authorized for this student")


@router.get("/students/{student_id}/mastery")
def student_mastery(student_id: str, user=Depends(current_user)):
    _self_or_prof(user, student_id)
    out = []
    for c in repo.concepts.values():
        m = repo.student_mastery(student_id, c["id"])
        if not m:
            continue
        nodes = [{"key": n["key"], "name": n["name"], "parent": n["parent_key"], "score": round(m.get(n["key"], {}).get("score", 0), 2)}
                 for n in repo.concept_nodes(c["id"])]
        out.append({"concept_id": c["id"], "name": c["name"], "mastery": round(sum(n["score"] for n in nodes) / len(nodes), 2), "nodes": nodes})
    return out


@router.get("/students/{student_id}/sessions")
def student_sessions(student_id: str, user=Depends(current_user)):
    _self_or_prof(user, student_id)
    return [{"id": s["id"], "concept": repo.concepts[s["concept_id"]]["name"], "status": s["status"], "started_at": s["started_at"],
             "final_state": (s.get("final") or {}).get("state"), "misconception": s["state"]["misconception"]["statement"]}
            for s in repo.sessions.values() if s["student_id"] == student_id]


@router.get("/students/{student_id}/dashboard")
def dashboard(student_id: str, user=Depends(current_user)):
    _self_or_prof(user, student_id)
    mastery = student_mastery(student_id, user)
    weak = sorted([{"concept_id": c["concept_id"], "concept": c["name"], "node": n["name"], "score": n["score"]}
                   for c in mastery for n in c["nodes"] if n["score"] < .6], key=lambda x: x["score"])[:5]
    sessions = student_sessions(student_id, user)
    mis = [e for e in repo.misconception_events if e["student_id"] == student_id and e["session_id"] != "seed"]
    days = {s["started_at"][:10] for s in sessions}
    return {"concepts": mastery, "recent_sessions": sorted(sessions, key=lambda s: s["started_at"], reverse=True)[:5],
            "weak": weak, "mastered": [c["name"] for c in mastery if c["mastery"] >= .8],
            "recommended": weak[0] if weak else None, "misconceptions": [{"statement": e["statement"], "corrected": e["corrected"]} for e in mis],
            "streak_days": len(days)}


# ---------- professor ----------
def _own_course(user, course_id):
    require_role(user, "professor")
    c = repo.courses.get(course_id)
    if not c or c["professor_id"] != user["id"]:
        raise HTTPException(404, "Course not found")
    return c


@router.post("/professor/courses")
def create_course(body: CourseCreate, user=Depends(current_user)):
    require_role(user, "professor")
    c = {"id": uid(), "professor_id": user["id"], "name": body.name}
    repo.courses[c["id"]] = c
    return c


@router.get("/professor/courses")
def list_courses(user=Depends(current_user)):
    require_role(user, "professor")
    return [{**c, "students": len(repo.course_student_ids(c["id"]))} for c in repo.courses.values() if c["professor_id"] == user["id"]]


@router.post("/professor/courses/{course_id}/students")
def add_student(course_id: str, body: AddStudent, user=Depends(current_user)):
    _own_course(user, course_id)
    if body.student_id not in repo.users or repo.users[body.student_id]["role"] != "student":
        raise HTTPException(404, "Student not found")
    repo.course_students.add((course_id, body.student_id))
    return {"ok": True}


@router.get("/professor/courses/{course_id}/analytics")
def course_analytics(course_id: str, user=Depends(current_user)):
    _own_course(user, course_id)
    return analytics.course_analytics(course_id)


@router.get("/professor/courses/{course_id}/misconceptions")
def course_misconceptions(course_id: str, user=Depends(current_user)):
    _own_course(user, course_id)
    return analytics.misconception_heatmap(course_id)


@router.get("/professor/courses/{course_id}/concepts/{concept_id}")
def professor_concept(course_id: str, concept_id: str, user=Depends(current_user)):
    _own_course(user, course_id)
    a = next((c for c in analytics.course_analytics(course_id)["concepts"] if c["concept_id"] == concept_id), None)
    if not a:
        raise HTTPException(404, "Concept not in course")
    return {**a, "misconceptions": [m for m in analytics.misconception_heatmap(course_id) if m["concept_id"] == concept_id]}


@router.get("/professor/courses/{course_id}/students/{student_id}")
def professor_student(course_id: str, student_id: str, user=Depends(current_user)):
    _own_course(user, course_id)
    if (course_id, student_id) not in repo.course_students:
        raise HTTPException(404, "Student not in course")
    return {"student": repo.users[student_id], "mastery": student_mastery(student_id, user), "sessions": student_sessions(student_id, user)}
