from collections import defaultdict

from app.database.repo import repo


def course_analytics(course_id: str) -> dict:
    sids = repo.course_student_ids(course_id)
    concepts = [c for c in repo.concepts.values() if c["course_id"] == course_id]
    out = []
    for c in concepts:
        nodes = repo.concept_nodes(c["id"])
        per_node = []
        for n in nodes:
            vals = [repo.mastery[(s, n["id"])]["score"] for s in sids if (s, n["id"]) in repo.mastery]
            per_node.append({"key": n["key"], "name": n["name"], "understanding": round(sum(vals) / len(vals), 2) if vals else None,
                             "students": len(vals)})
        scored = [p["understanding"] for p in per_node if p["understanding"] is not None]
        avg = round(sum(scored) / len(scored), 2) if scored else None
        weakest = min((p for p in per_node if p["understanding"] is not None), key=lambda p: p["understanding"], default=None)
        out.append({"concept_id": c["id"], "name": c["name"], "understanding": avg, "nodes": per_node,
                    "root_issue": f"Students struggle most with {weakest['name']}." if weakest and weakest["understanding"] < .6 else None,
                    "reteach": f"Reteach {weakest['name']} with worked examples." if weakest and weakest["understanding"] < .6 else None})
    out.sort(key=lambda x: (x["understanding"] is None, -(x["understanding"] or 0)))
    return {"course_id": course_id, "students": len(sids), "concepts": out}


def misconception_heatmap(course_id: str) -> list[dict]:
    sids = set(repo.course_student_ids(course_id))
    groups = defaultdict(list)
    for e in repo.misconception_events:
        if e["student_id"] in sids and not e["corrected"]:
            groups[(e["concept_id"], e["statement"])].append(e)
    rows = []
    for (cid, stmt), evs in groups.items():
        students = {e["student_id"] for e in evs}
        node = evs[0]["node_key"]
        rows.append({"id": f"{cid}|{stmt}", "concept_id": cid, "concept": repo.concepts[cid]["name"], "statement": stmt,
                     "students": len(students), "node": repo.nodes.get(f"{cid}.{node}", {}).get("name", node),
                     "samples": [f"Student {abs(hash(e['student_id'])) % 900 + 100}: {e['sample']}" for e in evs[:3] if e["sample"]],
                     "reteach": evs[0].get("reteach", "")})
    return sorted(rows, key=lambda r: -r["students"])
