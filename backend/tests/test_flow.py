from fastapi.testclient import TestClient
from main import app

S = {"X-User-Id": "student-demo"}
P = {"X-User-Id": "prof-demo"}


def test_full_loop():
    with TestClient(app) as c:
        s = c.post("/sessions", json={"concept_id": "binary_search"}, headers=S).json()
        sid = s["id"]
        assert "sorted" in s["messages"][0]["content"].lower()
        hint = c.get(f"/sessions/{sid}/hint", headers=S).json()
        assert "analogy" in hint and "guidance" in hint and len(hint["key_points"]) > 0
        texts = [
            "No. Sorting is required because the ordering lets us eliminate half of the search space: if the middle is smaller than the target, everything to its left is smaller too, so we discard it.",
            "We compare the target with the middle element, then discard half of the remaining range, and repeat. That is why it narrows quickly.",
            "If the target is smaller than every element, the high pointer keeps moving left until low > high, which is an empty range, so we return not found. We use mid + 1 and mid - 1 to avoid infinite loops.",
            "Each step halves n, so after k steps n / 2^k = 1, which means k = log2 n, so the complexity is logarithmic, O(log n).",
        ]
        for t in texts:
            r = c.post(f"/sessions/{sid}/message", json={"input": {"type": "text", "content": t}}, headers=S).json()
        assert r["ready_for_transfer"]
        q = c.post(f"/sessions/{sid}/transfer-test", headers=S).json()
        assert "usernames" in q["question"]
        f = c.post(f"/sessions/{sid}/transfer-test/answer", headers=S, json={"input": {"content":
            "Because the usernames are sorted alphabetically I check the middle, then discard half each time, repeatedly halving, so about 20 steps, log2 of a million."}}).json()
        assert f["state"] in {"MASTERED", "PARTIALLY_MASTERED", "NEEDS_REINFORCEMENT"}
        assert c.get("/professor/courses/course-ds/misconceptions", headers=P).json()[0]["students"] >= 1


def test_isolation():
    with TestClient(app) as c:
        sid = c.post("/sessions", json={"concept_id": "recursion"}, headers=S).json()["id"]
        assert c.get(f"/sessions/{sid}", headers={"X-User-Id": "stu-01"}).status_code == 403
        assert c.get("/professor/courses", headers=S).status_code == 403

        # Test subjects exist
        for subj in ["Mathematics", "Physics", "Chemistry", "Biology", "Economics", "Engineering", "General Knowledge"]:
            res = c.get(f"/concepts?subject={subj}", headers=S).json()
            assert len(res) >= 1, f"Expected concepts for {subj}"

        # Test seamless signup/login for existing email
        u1 = c.post("/auth/signup", json={"name": "Alice", "email": "alice@test.edu", "role": "student"}).json()
        assert u1["email"] == "alice@test.edu"
        # Signing up again with same email returns user without error
        u2 = c.post("/auth/signup", json={"name": "Alice", "email": "alice@test.edu", "role": "student"}).json()
        assert u2["id"] == u1["id"]

