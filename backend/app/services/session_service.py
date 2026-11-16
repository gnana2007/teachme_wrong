"""Session state machine:
   TEACHING --(ready: corrected + enough turns)--> TRANSFER --(answer)--> COMPLETE
"""
from fastapi import HTTPException

from app.agents import agents
from app.database.repo import repo, now, uid
from app.mastery import engine
from app.rag.store import vector_store
from app.schemas.models import StudentInput

TURNS_MIN, TURNS_MAX = 4, 8


def _concept_ctx(concept_id):
    c = repo.concepts[concept_id]
    return c, repo.concept_nodes(concept_id)


def get_owned(session_id: str, user: dict) -> dict:
    s = repo.sessions.get(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    if s["student_id"] != user["id"]:
        raise HTTPException(403, "This session belongs to another student")
    return s


def progress(session) -> list[dict]:
    c, nodes = _concept_ctx(session["concept_id"])
    m = repo.student_mastery(session["student_id"], c["id"])
    st = session["state"]
    out = []
    for n in nodes:
        score = m.get(n["key"], {}).get("score", 0.0)
        status = "untested" if n["key"] not in m else "strong" if score >= .75 else "developing" if score >= .55 else "weak"
        out.append({"key": n["key"], "name": n["name"], "parent": n["parent_key"], "description": n.get("description", ""),
                    "score": round(score, 2), "status": status, "focus": n["key"] == st.get("focus_node")})
    return out


def view(session) -> dict:
    c = repo.concepts[session["concept_id"]]
    st = session["state"]
    return {"id": session["id"], "concept": {"id": c["id"], "name": c["name"]}, "status": session["status"],
            "phase": st["phase"], "difficulty": st["difficulty"], "turn": st["turn"],
            "student_name": "Alex", "student_tagline": "Alex — your confused AI student",
            "current_misconception": st["misconception"]["statement"] if st["phase"] == "TEACHING" else None,
            "messages": [{"id": m["id"], "sender": m["sender"], "content": m["content"], "created_at": m["created_at"]}
                         for m in repo.session_messages(session["id"])],
            "progress": progress(session), "ready_for_transfer": st["turn"] >= TURNS_MIN and st["misconception_corrected"] or st["turn"] >= TURNS_MAX,
            "transfer_question": (repo.transfer_tests.get(session["id"]) or {}).get("question"),
            "final": session.get("final")}


async def create_session(user: dict, concept_id: str, material_id: str | None) -> dict:
    if concept_id not in repo.concepts:
        raise HTTPException(404, "Concept not found")
    c, nodes = _concept_ctx(concept_id)
    mis = repo.concept_misconceptions(concept_id)
    if not mis:
        accepted = await agents.generate_validated_misconceptions(c["id"], c["name"], nodes, _source(material_id))
        if not accepted:
            raise HTTPException(422, "Could not generate a validated misconception for this concept")
        for m in accepted:
            mid = uid()
            repo.misconceptions[mid] = {"id": mid, "concept_id": concept_id, "node_key": m["target_node"], "statement": m["statement"],
                                        "severity": m["severity"], "difficulty": m["difficulty"], "reason": m.get("reason", "")}
        mis = repo.concept_misconceptions(concept_id)
    # prefer a misconception this student has not yet worked on
    done = {s["state"]["misconception"]["statement"] for s in repo.sessions.values()
            if s["student_id"] == user["id"] and s["concept_id"] == concept_id and s["state"]["misconception_corrected"] and not s.get("seeded")}
    chosen = next((m for m in mis if m["statement"] not in done), mis[0])
    misconception = {"target_node": chosen["node_key"], "statement": chosen["statement"], "severity": chosen["severity"],
                     "difficulty": chosen["difficulty"]}
    sid = uid()
    state = {"phase": "TEACHING", "difficulty": max(1, min(6, chosen["difficulty"])), "turn": 0, "attempts": 0,
             "focus_node": chosen["node_key"], "misconception": misconception, "misconception_corrected": False,
             "nodes_explained": [], "weak_concepts": [], "concepts_mastered": [], "last_strong": False}
    session = {"id": sid, "student_id": user["id"], "concept_id": concept_id, "material_id": material_id, "status": "ACTIVE",
               "started_at": now(), "ended_at": None, "state": state}
    repo.sessions[sid] = session
    repo.add_message(sid, "ai", misconception["statement"])
    return view(session)


def _source(material_id):
    return (repo.materials.get(material_id) or {}).get("extracted_text", "") if material_id else ""


async def handle_message(session: dict, inp: StudentInput) -> dict:
    st = session["state"]
    if st["phase"] != "TEACHING":
        raise HTTPException(409, f"Session is in phase {st['phase']}")
    text = inp.text
    if not text:
        raise HTTPException(400, "Empty explanation")
    c, nodes = _concept_ctx(session["concept_id"])
    keys = [n["key"] for n in nodes]
    msg = repo.add_message(session["id"], "student", text, input_type=inp.type)
    history = [{"sender": m["sender"], "content": m["content"]} for m in repo.session_messages(session["id"])]
    chunks = vector_store.search(session.get("material_id"), text)

    ev = await agents.evaluate_explanation(text=text, concept_key=c["id"], nodes=nodes, misconception=st["misconception"],
                                           history=history, focus_node=st["focus_node"], chunks=chunks)
    new_mastery = engine.apply_evaluation(repo.student_mastery(session["student_id"], c["id"]), keys, ev, st["difficulty"])
    repo.save_mastery(session["student_id"], c["id"], new_mastery)
    repo.evaluations.append({"id": uid(), "session_id": session["id"], "message_id": msg["id"], **ev})

    st["attempts"] += 1
    st["turn"] += 1
    st["misconception_corrected"] = st["misconception_corrected"] or bool(ev["misconception_corrected"])
    st["nodes_explained"] = sorted(set(st["nodes_explained"]) | set(ev["nodes_demonstrated"]))
    st["difficulty"] = engine.adjust_difficulty(st["difficulty"], ev)
    st["last_strong"] = (ev["accuracy"] + ev["reasoning"]) / 2 >= 0.72
    st["weak_concepts"] = [k for k in keys if new_mastery.get(k, {"score": 0})["score"] < .55]
    st["concepts_mastered"] = [k for k in keys if new_mastery.get(k, {"score": 0})["score"] >= .8]

    # next focus = lowest mastery node (untested counts as 0), avoiding immediate repetition when possible
    ranked = sorted(keys, key=lambda k: new_mastery.get(k, {"score": 0})["score"])
    st["focus_node"] = next((k for k in ranked if k != st["focus_node"]), ranked[0])
    q = await agents.choose_question(st["difficulty"], st["focus_node"])
    node = next(n for n in nodes if n["key"] == st["focus_node"])
    reply = await agents.student_reply(concept_key=c["id"], node=node, misconception=st["misconception"], qtype=q["question_type"],
                                       turn=st["turn"], history=history, last_strong=st["last_strong"])
    ai_msg = repo.add_message(session["id"], "ai", reply["message"], question_type=reply.get("question_type"))
    v = view(session)
    return {"ai_message": {"id": ai_msg["id"], "content": reply["message"]},
            "feedback": {"text": ev["feedback"], "strengths": ev.get("strengths", []),
                         "needs_work": [n["name"] for n in nodes if n["key"] in ev["weak_nodes"]][:3],
                         "misconception_corrected": st["misconception_corrected"],
                         "scores": {k: ev[k] for k in ("accuracy", "reasoning", "completeness", "concept_coverage")}},
            "progress": v["progress"], "difficulty": st["difficulty"], "ready_for_transfer": v["ready_for_transfer"],
            "question_type": reply.get("question_type")}


async def get_hint(session: dict) -> dict:
    c, nodes = _concept_ctx(session["concept_id"])
    st = session["state"]
    focus_key = st.get("focus_node")
    node = next((n for n in nodes if n["key"] == focus_key), nodes[0])
    mis = st.get("misconception", {})
    history = [{"sender": m["sender"], "content": m["content"]} for m in repo.session_messages(session["id"])]
    hint_data = await agents.generate_hint(
        concept_name=c["name"],
        node=node,
        misconception=mis,
        difficulty=st["difficulty"],
        history=history[-4:]
    )
    return {
        "concept": c["name"],
        "node_key": node["key"],
        "node_name": node["name"],
        "node_description": node.get("description", ""),
        "difficulty": st["difficulty"],
        "misconception": mis.get("statement", ""),
        "analogy": hint_data.get("analogy", ""),
        "guidance": hint_data.get("guidance", ""),
        "key_points": hint_data.get("key_points", []),
        "level_tip": hint_data.get("level_tip", "")
    }


async def start_transfer(session: dict) -> dict:
    st = session["state"]
    if st["phase"] == "COMPLETE":
        raise HTTPException(409, "Session already complete")
    c, nodes = _concept_ctx(session["concept_id"])
    history = [m["content"] for m in repo.session_messages(session["id"]) if m["sender"] == "ai"]
    t = await agents.generate_transfer(c["id"], c["name"], nodes, history)
    repo.transfer_tests[session["id"]] = {"id": uid(), "session_id": session["id"], "question": t["question"],
                                          "tests_nodes": t["tests_nodes"], "rubric": t.get("rubric", []), "answer": None, "evaluation": None}
    st["phase"] = "TRANSFER"
    return {"question": t["question"], "phase": "TRANSFER"}


async def answer_transfer(session: dict, inp: StudentInput) -> dict:
    st = session["state"]
    if st["phase"] != "TRANSFER":
        raise HTTPException(409, "Start the transfer test first")
    text = inp.text
    if not text:
        raise HTTPException(400, "Empty answer")
    c, nodes = _concept_ctx(session["concept_id"])
    t = repo.transfer_tests[session["id"]]
    ev = await agents.evaluate_explanation(text=text, concept_key=c["id"], nodes=nodes, misconception=st["misconception"],
                                           history=[{"sender": "ai", "content": t["question"]}], focus_node=None,
                                           chunks=vector_store.search(session.get("material_id"), text))
    tested = t["tests_nodes"]
    cov = len([k for k in tested if k in ev["nodes_demonstrated"]]) / max(len(tested), 1)
    score = round(0.5 * ev["accuracy"] + 0.3 * ev["reasoning"] + 0.2 * cov, 2)
    keys = [n["key"] for n in nodes]
    mastery = engine.apply_evaluation(repo.student_mastery(session["student_id"], c["id"]), keys, ev, 6)
    repo.save_mastery(session["student_id"], c["id"], mastery)
    t.update(answer=text, evaluation={**ev, "transfer_score": score})
    return await finalize(session, score, ev)


async def finalize(session: dict, transfer_score: float | None, last_ev: dict | None = None) -> dict:
    c, nodes = _concept_ctx(session["concept_id"])
    st = session["state"]
    m = repo.student_mastery(session["student_id"], c["id"])
    scores = {n["key"]: m.get(n["key"], {"score": 0})["score"] for n in nodes}
    avg = sum(scores.values()) / max(len(scores), 1)
    state = engine.final_state(avg, transfer_score, st["misconception_corrected"])
    names = {n["key"]: n["name"] for n in nodes}
    strong = [names[k] for k, v in scores.items() if v >= .75]
    needs = [names[k] for k, v in scores.items() if v < .6]
    label = state.replace("_", " ").capitalize()
    fallback = (f"{label}. " + (f"You can explain {', '.join(strong)}. " if strong else "") +
                (f"Your explanation of {', '.join(needs)} remains incomplete. " if needs else "") +
                ("The misconception was corrected." if st["misconception_corrected"] else "The original misconception is not yet fully corrected."))
    st["phase"] = "COMPLETE"
    session.update(status="COMPLETE", ended_at=now())
    session["final"] = {"state": state, "explanation": fallback, "strong": strong, "needs_reinforcement": needs,
                        "misconception_corrected": st["misconception_corrected"], "misconception": st["misconception"]["statement"],
                        "transfer_score": transfer_score, "transfer_passed": bool(transfer_score is not None and transfer_score >= .6),
                        "mastery": scores}
    student_msgs = [x["content"] for x in repo.session_messages(session["id"]) if x["sender"] == "student"]
    repo.misconception_events.append({"session_id": session["id"], "student_id": session["student_id"], "concept_id": c["id"],
                                      "node_key": st["misconception"]["target_node"], "statement": st["misconception"]["statement"],
                                      "corrected": st["misconception_corrected"], "sample": (student_msgs[0] if student_msgs else ""),
                                      "reteach": f"Revisit {names.get(st['misconception']['target_node'], 'this idea')} with a worked example",
                                      "created_at": now()})
    return session["final"]
