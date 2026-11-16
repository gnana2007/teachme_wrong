"""Concept-level mastery from weighted evidence (not a plain average).

Each node stores (score, evidence_weight). New evidence e with weight w:
    W' = W * DECAY ; score' = (score*W' + e*w) / (W' + w) ; weight = W' + w
Weight w grows with question difficulty, so a strong proof answer moves the score
more than an easy recall answer; DECAY lets recent performance matter more.
Initial prior = 0.2 with weight 0.5 (little evidence => easy to move).
"""
DECAY = 0.85
PRIOR = (0.2, 0.5)


def evidence_for_node(ev: dict, node_key: str) -> float | None:
    """Return evidence in [0,1] for a node from an evaluation, or None if not touched."""
    demonstrated = node_key in ev.get("nodes_demonstrated", [])
    weak = node_key in ev.get("weak_nodes", [])
    quality = 0.5 * ev["accuracy"] + 0.3 * ev["reasoning"] + 0.2 * ev["completeness"]
    if demonstrated:
        return quality
    if weak and node_key == ev.get("focus_node"):
        return min(quality, 0.35)  # was asked about it and did not show it
    return None


def update_node(score: float, weight: float, evidence: float, difficulty: int) -> tuple[float, float]:
    w = 0.6 + 0.2 * difficulty
    W = weight * DECAY
    return round((score * W + evidence * w) / (W + w), 4), W + w


def apply_evaluation(mastery: dict, node_keys: list[str], ev: dict, difficulty: int) -> dict:
    """mastery: {node_key: {"score":..,"weight":..}} -> mutated copy."""
    out = {k: dict(v) for k, v in mastery.items()}
    for key in node_keys:
        e = evidence_for_node(ev, key)
        if e is None:
            continue
        cur = out.get(key, {"score": PRIOR[0], "weight": PRIOR[1]})
        s, w = update_node(cur["score"], cur["weight"], e, difficulty)
        out[key] = {"score": s, "weight": w}
    return out


def final_state(avg: float, transfer: float | None, corrected: bool) -> str:
    t = 0.0 if transfer is None else transfer
    if avg >= 0.78 and t >= 0.7 and corrected:
        return "MASTERED"
    if avg < 0.5 or t < 0.4:
        return "NEEDS_REINFORCEMENT"
    return "PARTIALLY_MASTERED"


def adjust_difficulty(difficulty: int, ev: dict) -> int:
    perf = (ev["accuracy"] + ev["reasoning"]) / 2
    if perf >= 0.72:
        difficulty += 1
    elif perf < 0.45:
        difficulty -= 1
    return max(1, min(6, difficulty))
