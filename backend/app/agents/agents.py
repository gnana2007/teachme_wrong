"""Single-responsibility agents. Each loads its own prompt and talks only to AIProvider."""
from app.ai.knowledge_library import QTYPE_BY_DIFFICULTY
from app.ai.prompts import load_prompt
from app.ai.provider import get_provider


async def analyze_concept(key: str, name: str, source_text: str = "") -> dict:
    ctx = {"key": key, "name": name}
    user = f"Topic: {name}\nSource excerpts:\n{source_text[:3000] or '(none)'}"
    return await get_provider().generate_structured("concept_analyzer", load_prompt("concept_analyzer"), user, ctx)


async def generate_validated_misconceptions(key: str, name: str, nodes: list[dict], source_text: str = "") -> list[dict]:
    """GENERATE -> GROUND -> PLAUSIBILITY -> RELEVANCE -> DIFFICULTY -> EDUCATIONAL VALUE -> store."""
    p = get_provider()
    ctx = {"key": key, "name": name, "nodes": nodes}
    user = f"Topic: {name}\nNodes: {[n['key'] for n in nodes]}\nSource:\n{source_text[:3000] or '(none)'}"
    cands = (await p.generate_structured("misconception_generator", load_prompt("misconception_generator"), user, ctx))["misconceptions"]
    valid_keys = {n["key"] for n in nodes}
    accepted = []
    for cand in cands:
        if cand.get("target_node") not in valid_keys:
            continue
        node = next(n for n in nodes if n["key"] == cand["target_node"])
        v = await p.generate_structured(
            "misconception_validator", load_prompt("misconception_validator"),
            f"Candidate: {cand}\nSource:\n{source_text[:2000] or '(none)'}",
            {"candidate": cand, "source_text": source_text, "node_words": node.get("keywords", [])})
        scores = [v[k] for k in ("grounded", "plausible", "relevant", "difficulty_fit", "educational_value")]
        if v.get("verdict") == "accept" and min(scores) >= 0.6 and sum(scores) / 5 >= 0.7:
            accepted.append({**cand, "validation": v})
    return accepted


async def evaluate_explanation(*, text, concept_key, nodes, misconception, history, focus_node, chunks) -> dict:
    """Independent evaluator. Never sees AI-student persona; returns structured JSON only."""
    ctx = {"text": text, "nodes": nodes, "misconception": misconception, "concept_key": concept_key}
    user = (f"Knowledge nodes: {[(n['key'], n['description']) for n in nodes]}\n"
            f"Current misconception: {misconception['statement']} (node {misconception['target_node']})\n"
            f"Source excerpts: {chunks}\nRecent conversation: {history[-6:]}\nStudent explanation: {text}")
    ev = await get_provider().evaluate(load_prompt("evaluator"), user, ctx)
    for k in ("accuracy", "reasoning", "completeness", "concept_coverage"):
        ev[k] = max(0.0, min(1.0, float(ev.get(k, 0))))
    ev["focus_node"] = focus_node
    ev.pop("chain_of_thought", None)
    return ev


async def choose_question(difficulty: int, focus_node: str) -> dict:
    ctx = {"difficulty": difficulty, "focus_node": focus_node}
    r = await get_provider().generate_structured("socratic_questioner", load_prompt("socratic_questioner"), f"{ctx}", ctx)
    r.setdefault("question_type", QTYPE_BY_DIFFICULTY[difficulty])
    return r


async def student_reply(*, concept_key, node, misconception, qtype, turn, history, last_strong) -> dict:
    ctx = {"concept_key": concept_key, "focus_node": node["key"], "node_name": node["name"], "misconception": misconception,
           "question_type": qtype, "turn": turn, "last_strong": last_strong}
    user = (f"State: {ctx}\nConversation: {history[-8:]}\nRespond as Alex with a {qtype} question about "
            f"'{node['name']}'. Do not reveal the answer.")
    return await get_provider().generate_structured("ai_student", load_prompt("ai_student"), user, ctx)


async def generate_transfer(key, name, nodes, history) -> dict:
    ctx = {"key": key, "name": name, "nodes": nodes}
    return await get_provider().generate_structured("transfer_generator", load_prompt("transfer_generator"),
                                                    f"Topic {name}; avoid reusing: {history[:2]}", ctx)


async def generate_hint(*, concept_name: str, node: dict, misconception: dict, difficulty: int, history: list) -> dict:
    ctx = {
        "concept_name": concept_name,
        "concept_key": concept_name.lower().replace(" ", "_"),
        "node_key": node["key"],
        "node_name": node["name"],
        "node_description": node.get("description", ""),
        "difficulty": difficulty,
        "misconception": misconception,
        "history": history
    }
    user = (f"Concept: {concept_name}\n"
            f"Idea: {node['name']} ({node.get('description', '')})\n"
            f"Alex's Misconception: {misconception.get('statement', '')}\n"
            f"Difficulty Level: {difficulty} of 6\n"
            f"Recent Context: {history[-4:]}")
    return await get_provider().generate_structured("tutor_hint", load_prompt("tutor_hint"), user, ctx)

