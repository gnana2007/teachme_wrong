"""Deterministic offline provider so the full loop runs with no API key."""
import re

from app.ai.knowledge_library import LIBRARY, QTYPE_BY_DIFFICULTY
from app.ai.provider import AIProvider


def _generic_nodes(topic: str):
    names = ["Definition", "Core mechanism", "Worked example", "Edge cases", "Applications"]
    return [{"key": n.lower().replace(" ", "_"), "name": n, "parent": None if i == 0 else names[i - 1].lower().replace(" ", "_"),
             "description": f"{n} of {topic}.", "keywords": [n.lower().split()[0], topic.lower().split()[0]]}
            for i, n in enumerate(names)]


class MockProvider(AIProvider):
    async def generate(self, task, system, user, context=None):
        return (await self.generate_structured(task, system, user, context)).get("message", "")

    async def generate_structured(self, task, system, user, context=None):
        c = context or {}
        return getattr(self, f"_{task}")(c)

    def _concept_analyzer(self, c):
        key = c.get("key")
        lib = LIBRARY.get(key)
        topic = c.get("name", "Topic")
        nodes = lib["nodes"] if lib else _generic_nodes(topic)
        return {"concept": topic, "prerequisites": lib["prerequisites"] if lib else [],
                "nodes": nodes, "relationships": [[n["parent"], n["key"]] for n in nodes if n["parent"]]}

    def _misconception_generator(self, c):
        lib = LIBRARY.get(c.get("key"))
        if lib:
            return {"misconceptions": lib["misconceptions"]}
        nodes = c.get("nodes", [])
        return {"misconceptions": [
            {"target_node": n["key"], "statement": f"I think {n['name'].lower()} isn't really needed to understand {c.get('name','this')}.",
             "severity": "medium", "difficulty": 1 + i, "reason": "Learners often underweight foundational ideas."}
            for i, n in enumerate(nodes[:3])]}

    def _misconception_validator(self, c):
        s = c["candidate"]["statement"]
        ok = len(s) >= 25
        grounded = 0.9 if not c.get("source_text") or any(
            w in c["source_text"].lower() for w in c.get("node_words", [])) else 0.4
        return {"grounded": grounded, "plausible": 0.85 if ok else 0.3, "relevant": 0.9, "difficulty_fit": 0.8,
                "educational_value": 0.85 if ok else 0.3, "verdict": "accept" if ok and grounded > 0.5 else "reject", "note": "mock validation"}

    def _ai_student(self, c):
        lib = LIBRARY.get(c["concept_key"])
        qtype, node = c["question_type"], c["focus_node"]
        if c["turn"] == 0:
            return {"message": c["misconception"]["statement"], "question_type": "BASIC"}
        q = (lib or {}).get("questions", {}).get(node, {})
        text = q.get(qtype) or next(iter(q.values()), None)
        if not text:
            name = c.get("node_name", node)
            text = {"WHY": f"Why does {name.lower()} matter? How do you know?",
                    "EXAMPLE": f"Can you give me a concrete example of {name.lower()}?",
                    "EDGE_CASE": f"What happens at the edges with {name.lower()}?",
                    "PROOF": f"Can you prove that {name.lower()} works the way you say?"}.get(qtype, f"Can you explain {name.lower()} more simply?")
        prefix = ""
        if c.get("last_strong"):
            prefix = "Okay, that makes some sense. "
        elif c["turn"] > 0:
            prefix = "Hmm, I'm still not sure. "
        return {"message": prefix + text, "question_type": qtype}

    def _socratic_questioner(self, c):
        return {"question_type": QTYPE_BY_DIFFICULTY[c["difficulty"]], "focus_node": c["focus_node"], "rationale": "mock"}

    def _evaluator(self, c):
        text = c["text"].lower()
        nodes = c["nodes"]
        demonstrated, weak = [], []
        for n in nodes:
            hits = sum(1 for k in n.get("keywords", []) if k in text)
            (demonstrated if hits >= 1 else weak).append(n["key"])
        words = len(re.findall(r"\w+", text))
        causal = sum(1 for w in ["because", "therefore", "so that", "since", "which means", "if ", "then", "otherwise"] if w in text)
        coverage = len(demonstrated) / max(len(nodes), 1)
        length_f = min(words / 40, 1.0)
        reasoning = min(0.25 + 0.2 * causal + 0.3 * length_f, 1.0)
        mis = c["misconception"]["target_node"]
        corrected = mis in demonstrated and causal >= 1 and words >= 12
        accuracy = min(0.35 + 0.1 * len(demonstrated) + (0.2 if corrected else 0), 1.0)
        completeness = min(0.2 + 0.7 * coverage * 1.5, 1.0) * (0.5 + 0.5 * length_f)
        strengths = [n["name"] for n in nodes if n["key"] in demonstrated]
        weak_names = [n["name"] for n in nodes if n["key"] in weak][:2]
        fb = ("You tied your claim to a reason, which is what makes an explanation convincing. " if causal else
              "You stated a claim but not why it is true; add the cause. ")
        if strengths:
            fb += f"Strong on: {', '.join(strengths[:2])}. "
        if weak_names:
            fb += f"Not yet explained: {', '.join(weak_names)}."
        return {"accuracy": round(accuracy, 2), "reasoning": round(reasoning, 2), "completeness": round(completeness, 2),
                "concept_coverage": round(coverage, 2), "misconception_corrected": corrected,
                "nodes_demonstrated": demonstrated, "weak_nodes": weak, "unsupported_claims": [], "feedback": fb.strip(),
                "strengths": strengths}

    def _transfer_generator(self, c):
        lib = LIBRARY.get(c.get("key"))
        if lib:
            return lib["transfer"]
        return {"question": f"Apply the main idea of {c.get('name')} to a situation from a completely different domain, and justify each step.",
                "tests_nodes": [n["key"] for n in c.get("nodes", [])[:3]], "rubric": ["Applies the principle", "Justifies steps"]}

    def _mastery_engine(self, c):
        return {"explanation": c["fallback"]}

    def _tutor_hint(self, c):
        node_key = c.get("node_key", "")
        node_name = c.get("node_name", "this concept")
        node_desc = c.get("node_description", "")
        diff = c.get("difficulty", 2)
        hints_db = {
            "sorted_array": {
                "analogy": "Think of looking up a word in a dictionary. Because the words are strictly alphabetical, checking the middle immediately tells you whether your target word lies in the left half or the right half.",
                "guidance": "In an unsorted list, checking the middle tells you nothing about where other numbers are located. Sorted ordering is the only property that allows one comparison to safely eliminate an entire half of the candidates.",
                "key_points": ["Sorted order is mandatory for elimination", "Explain why looking at the middle of an unsorted list gives zero directional information"],
                "level_tip": "Give Alex a quick counterexample like [9, 2, 7, 1, 5] where checking the middle fails to help find 2 or 1."
            },
            "middle_element": {
                "analogy": "Like cutting a length of rope exactly in half rather than trimming a millimeter at a time.",
                "guidance": "Probing `mid = (low + high) // 2` splits our remaining search space into two equal parts. Comparing target to array[mid] guarantees we shrink our problem space at the maximum possible rate.",
                "key_points": ["Calculate mid = (low + high) // 2", "Compare array[mid] to target to decide whether to search left or right"],
                "level_tip": "Walk Alex step-by-step through checking whether target is less than or greater than array[mid]."
            },
            "search_reduction": {
                "analogy": "Like the classic 'guess a number from 1 to 100' game with higher/lower hints. Every guess cuts the remaining candidates in half (100 -> 50 -> 25 -> 12 -> 6 -> 3 -> 1).",
                "guidance": "Each comparison eliminates 50% of all remaining candidates. That creates exponential reduction in search space, which is why it runs in just ~20 steps for 1 million items.",
                "key_points": ["Each step eliminates half the remaining space", "Contrast with linear search which only rules out 1 item at a time"],
                "level_tip": "Explain the halving mechanism to Alex and contrast it with checking elements sequentially."
            },
            "boundary": {
                "analogy": "Think of two walls (low and high pointers) closing inward. When low passes high, the room between them has shrunk to zero size.",
                "guidance": "Setting `high = mid - 1` and `low = mid + 1` ensures the search window strictly shrinks on every iteration and avoids infinite loops. The loop stops when `low > high`, proving the target is not in the array.",
                "key_points": ["Update high = mid - 1 or low = mid + 1 to avoid infinite loops", "Termination happens when low > high, meaning search space is empty"],
                "level_tip": "Show Alex how setting high = mid on a 2-element array can loop forever."
            },
            "complexity": {
                "analogy": "Repeatedly folding a sheet of paper in half: 20 folds creates over 1,000,000 layers. Unfolding in reverse is logarithms!",
                "guidance": "Because we divide n by 2 on each step, after k steps we have n / (2^k) = 1 items left, giving k = log2(n). Therefore the time complexity is O(log n), which grows extremely slowly.",
                "key_points": ["Repeated halving mathematically corresponds to log2(n)", "Logarithmic growth means doubling data size only adds 1 extra comparison"],
                "level_tip": "Show Alex that n / 2^k = 1 leads directly to k = log2(n)."
            },
            "base_case": {
                "analogy": "Like the ground floor of an elevator or the emergency stop switch. Without it, you plunge indefinitely.",
                "guidance": "A recursive function must have a base case that returns a known answer without calling itself again. Without it, the function calls itself forever until stack overflow.",
                "key_points": ["Base case specifies when the recursion stops", "Without an explicit base case, the computer cannot know when to terminate"],
                "level_tip": "Help Alex see that the program does not stop automatically; you must write the termination condition."
            },
            "call_stack": {
                "analogy": "Like stacking trays in a cafeteria. Each recursive call places a new tray on top of the pile until the stack hits the ceiling.",
                "guidance": "Each function call allocates a new stack frame storing local variables and return addresses. If recursion doesn't stop, stack frames consume all allocated memory, throwing a StackOverflowError.",
                "key_points": ["Each function invocation adds a stack frame in memory", "Unbounded recursion exhausts stack memory even if local variables are tiny"],
                "level_tip": "Explain to Alex what a stack frame is and why infinite calls exhaust memory."
            }
        }
        if node_key in hints_db:
            return hints_db[node_key]
        return {
            "analogy": f"Think of {node_name.lower()} as a key cornerstone in understanding this subject.",
            "guidance": f"{node_desc or f'Understanding {node_name} is essential'}. Focus on the underlying causal mechanism: explain WHY it works that way, not just the definition.",
            "key_points": [f"Explain the purpose of {node_name}", "Contrast with a common beginner misconception", "Provide a concrete 1-sentence example"],
            "level_tip": f"At Level {diff}, support your claim with a clear 'because' or cause-and-effect reasoning."
        }

