"""Repository layer. MemoryRepo powers dev/demo; implement the same surface against
Supabase (schema.sql) for production. Services never touch storage directly."""
import uuid
from datetime import datetime, timezone


def uid() -> str:
    return uuid.uuid4().hex[:12]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class MemoryRepo:
    def __init__(self):
        self.users: dict[str, dict] = {}
        self.courses: dict[str, dict] = {}
        self.course_students: set[tuple[str, str]] = set()
        self.concepts: dict[str, dict] = {}
        self.nodes: dict[str, dict] = {}          # id -> node
        self.misconceptions: dict[str, dict] = {}
        self.materials: dict[str, dict] = {}
        self.sessions: dict[str, dict] = {}
        self.messages: list[dict] = []
        self.evaluations: list[dict] = []
        self.mastery: dict[tuple[str, str], dict] = {}   # (student_id, node_id) -> {score, weight, updated_at}
        self.transfer_tests: dict[str, dict] = {}
        self.misconception_events: list[dict] = []

    # --- helpers ---
    def add_user(self, name, email, role, id=None):
        u = {"id": id or uid(), "name": name, "email": email, "role": role, "created_at": now()}
        self.users[u["id"]] = u
        return u

    def add_concept(self, name, subject, description, difficulty, nodes, misconceptions, course_id=None, id=None, owner_id=None):
        cid = id or uid()
        self.concepts[cid] = {"id": cid, "course_id": course_id, "name": name, "subject": subject,
                              "description": description, "difficulty": difficulty, "owner_id": owner_id}
        for n in nodes:
            nid = f"{cid}.{n['key']}"
            self.nodes[nid] = {"id": nid, "concept_id": cid, "key": n["key"], "name": n["name"],
                               "description": n.get("description", ""), "parent_key": n.get("parent"),
                               "keywords": n.get("keywords", [])}
        for m in misconceptions:
            mid = uid()
            self.misconceptions[mid] = {"id": mid, "concept_id": cid, "node_key": m["target_node"], "statement": m["statement"],
                                        "severity": m["severity"], "difficulty": m["difficulty"], "reason": m.get("reason", "")}
        return self.concepts[cid]

    def concept_nodes(self, concept_id):
        return [n for n in self.nodes.values() if n["concept_id"] == concept_id]

    def concept_misconceptions(self, concept_id):
        return sorted((m for m in self.misconceptions.values() if m["concept_id"] == concept_id), key=lambda m: m["difficulty"])

    def student_mastery(self, student_id, concept_id) -> dict:
        """-> {node_key: {score, weight}}"""
        out = {}
        for n in self.concept_nodes(concept_id):
            m = self.mastery.get((student_id, n["id"]))
            if m:
                out[n["key"]] = {"score": m["score"], "weight": m["weight"]}
        return out

    def save_mastery(self, student_id, concept_id, mastery: dict):
        for key, v in mastery.items():
            self.mastery[(student_id, f"{concept_id}.{key}")] = {**v, "updated_at": now()}

    def add_message(self, session_id, sender, content, **extra):
        m = {"id": uid(), "session_id": session_id, "sender": sender, "content": content, "created_at": now(), **extra}
        self.messages.append(m)
        return m

    def session_messages(self, session_id):
        return [m for m in self.messages if m["session_id"] == session_id]

    def course_student_ids(self, course_id):
        return [s for c, s in self.course_students if c == course_id]


repo = MemoryRepo()
