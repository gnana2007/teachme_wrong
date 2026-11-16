"""Seeded demo: Binary Search + Alex, a finished sample session, and a 32-student class."""
import random

from app.ai.knowledge_library import LIBRARY
from app.database.repo import repo, now

DEMO_STUDENT, DEMO_PROF, DEMO_COURSE = "student-demo", "prof-demo", "course-ds"

EXTRA = {
    "arrays": ("Arrays", .92, ["Indexing", "Contiguous memory", "Bounds"]),
    "linked_lists": ("Linked Lists", .81, ["Nodes and pointers", "Traversal", "Insertion"]),
    "stacks": ("Stacks", .76, ["LIFO order", "Push/pop", "Underflow"]),
    "time_complexity": ("Time Complexity", .37, ["Growth rates", "Big-O meaning", "Logarithms"]),
}
MISCONCEPTION_EVENTS = [
    ("recursion", "base_case", "Recursion automatically stops", 31, "Base cases and call-stack behavior",
     "I think it just ends when there is nothing left to call."),
    ("time_complexity", "big_o_meaning", "O(log n) means constant time", 26, "Growth rates: contrast O(1), O(log n), O(n)",
     "Log n barely grows so it is basically the same as O(1)."),
    ("recursion", "call_stack", "Stack memory is the same as the stack data structure", 19, "Call stack vs. stack ADT",
     "The stack in recursion is the data structure we learned, right?"),
    ("binary_search", "sorted_array", "Binary search works on unsorted data", 12, "Why order enables elimination",
     "You just pick the middle and compare, so sorting is optional."),
]


def seed():
    if repo.users:
        return
    repo.add_user("Demo Student", "student@demo.edu", "student", DEMO_STUDENT)
    repo.add_user("Prof. Rao", "prof@demo.edu", "professor", DEMO_PROF)
    repo.courses[DEMO_COURSE] = {"id": DEMO_COURSE, "professor_id": DEMO_PROF, "name": "Data Structures (CSE-A)"}
    ids = {}
    for key, lib in LIBRARY.items():
        ids[key] = repo.add_concept(lib["name"], lib["subject"], lib["description"], lib["difficulty"],
                                    lib["nodes"], lib["misconceptions"], DEMO_COURSE, id=key)["id"]
    for key, (name, _, node_names) in EXTRA.items():
        nodes = [{"key": n.lower().replace(" ", "_").replace("/", "_"), "name": n, "description": f"{n} in {name}.",
                  "parent": None if i == 0 else node_names[i - 1].lower().replace(" ", "_").replace("/", "_")}
                 for i, n in enumerate(node_names)]
        if key == "time_complexity":
            nodes[1]["key"] = "big_o_meaning"
            nodes[2]["parent"] = "big_o_meaning"
            nodes[0]["key"] = "growth_rates"
            nodes[1]["parent"] = "growth_rates"
        mis = [{"target_node": nodes[0]["key"], "statement": f"I think {name.lower()} is only about memorising definitions.",
                "severity": "low", "difficulty": 1}]
        repo.add_concept(name, "Computer Science", f"{name} fundamentals.", 2, nodes, mis, DEMO_COURSE, id=key)

    rng = random.Random(7)
    targets = {"arrays": .92, "linked_lists": .81, "stacks": .76, "recursion": .54, "time_complexity": .37, "binary_search": .66}
    for i in range(32):
        sid = f"stu-{i:02d}"
        repo.add_user(f"Student {i+1:02d}", f"s{i}@demo.edu", "student", sid)
        repo.course_students.add((DEMO_COURSE, sid))
        for cid, t in targets.items():
            for n in repo.concept_nodes(cid):
                repo.mastery[(sid, n["id"])] = {"score": round(max(.05, min(.99, rng.gauss(t, .12))), 3), "weight": 2.0, "updated_at": now()}
    repo.course_students.add((DEMO_COURSE, DEMO_STUDENT))
    for cid, node_key, statement, count, reteach, sample in MISCONCEPTION_EVENTS:
        for i in range(count):
            repo.misconception_events.append({
                "session_id": "seed", "student_id": f"stu-{i % 32:02d}", "concept_id": cid, "node_key": node_key,
                "statement": statement, "corrected": False, "sample": sample, "reteach": reteach, "created_at": now()})

    # Demo student: one completed Binary Search session with realistic messages
    sid = "session-demo"
    repo.sessions[sid] = {"id": sid, "student_id": DEMO_STUDENT, "concept_id": "binary_search", "status": "COMPLETE",
                          "started_at": now(), "ended_at": now(), "material_id": None, "seeded": True,
                          "state": {"phase": "COMPLETE", "difficulty": 4, "turn": 3, "attempts": 3, "focus_node": "complexity",
                                    "misconception": LIBRARY["binary_search"]["misconceptions"][0], "misconception_corrected": True,
                                    "nodes_explained": ["sorted_array", "search_reduction"], "weak_concepts": ["complexity", "boundary"],
                                    "concepts_mastered": ["sorted_array"]},
                          "final": {"state": "PARTIALLY_MASTERED", "explanation": "Partially mastered. You explained why ordering enables elimination; complexity and boundary conditions remain incomplete.",
                                    "transfer_passed": True}}
    for sender, content in [
        ("ai", LIBRARY["binary_search"]["misconceptions"][0]["statement"]),
        ("student", "No. The ordering is what lets us eliminate half of the search space, because if the middle is smaller than the target, everything left of it is smaller too."),
        ("ai", "But why can we safely eliminate the left half? How do you know?"),
        ("student", "Since the array is sorted, all items to the left of the middle are less than or equal to it, so the target can't be there. Then we halve the remaining range again."),
    ]:
        repo.add_message(sid, sender, content)
    repo.save_mastery(DEMO_STUDENT, "binary_search", {
        "sorted_array": {"score": .95, "weight": 2}, "middle_element": {"score": .88, "weight": 2},
        "search_reduction": {"score": .91, "weight": 2}, "boundary": {"score": .63, "weight": 2}, "complexity": {"score": .42, "weight": 2}})
