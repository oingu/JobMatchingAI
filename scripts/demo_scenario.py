"""
Run an end-to-end demo scenario against local FastAPI server.

Usage:
  1) Start server: uvicorn app.main:app --reload
  2) Run: python scripts/demo_scenario.py
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

BASE_URL = "http://127.0.0.1:8000"


def request(method: str, path: str, payload: dict | None = None, token: str | None = None) -> dict:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}{path}", data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read().decode("utf-8")
            return json.loads(data) if data else {}
    except urllib.error.HTTPError as exc:
        msg = exc.read().decode("utf-8")
        raise RuntimeError(f"{method} {path} failed: {exc.code} {msg}") from exc


def create_user(name: str, email: str, password: str, role: str) -> int:
    res = request(
        "POST",
        "/users",
        {"name": name, "email": email, "password": password, "role": role, "is_online": False},
    )
    return int(res["data"]["id"])


def login(email: str, password: str) -> tuple[str, int]:
    res = request("POST", "/auth/login", {"email": email, "password": password})
    return str(res["data"]["token"]), int(res["data"]["user_id"])


def main() -> None:
    print("Creating users...")
    recruiter_id = create_user("Recruiter Demo", "recruiter.demo@example.com", "secret123", "recruiter")
    candidate_a = create_user("Candidate A", "candidate.a@example.com", "secret123", "candidate")
    candidate_b = create_user("Candidate B", "candidate.b@example.com", "secret123", "candidate")

    recruiter_token, _ = login("recruiter.demo@example.com", "secret123")
    candidate_a_token, _ = login("candidate.a@example.com", "secret123")
    candidate_b_token, _ = login("candidate.b@example.com", "secret123")

    print("Creating profiles...")
    request(
        "POST",
        "/recruiter-profiles",
        {"user_id": recruiter_id, "company_name": "Demo Corp"},
        recruiter_token,
    )
    request(
        "POST",
        "/candidate-profiles",
        {
            "user_id": candidate_a,
            "skills": ["python", "sql", "fastapi"],
            "experience_level": "junior",
            "preferred_locations": ["hanoi"],
            "preferred_salary_min": 900,
        },
        candidate_a_token,
    )
    request(
        "POST",
        "/candidate-profiles",
        {
            "user_id": candidate_b,
            "skills": ["java", "spring"],
            "experience_level": "junior",
            "preferred_locations": ["hanoi"],
            "preferred_salary_min": 800,
        },
        candidate_b_token,
    )

    print("Creating job and forcing event processing...")
    request(
        "POST",
        "/jobs",
        {
            "recruiter_id": recruiter_id,
            "title": "Backend Engineer",
            "required_skills": ["python", "sql"],
            "location": "hanoi",
            "salary_min": 1000,
            "salary_max": 2000,
            "experience_level": "junior",
        },
        recruiter_token,
    )
    request("POST", "/events/process?limit=20", token=recruiter_token)

    feed = request("GET", f"/feed/candidate/{candidate_a}", token=candidate_a_token)
    items = feed["data"]["items"]
    print(f"Candidate A feed size: {len(items)}")
    if items:
        job_id = items[0]["job_id"]
        request(
            "POST",
            "/interactions",
            {"user_id": candidate_a, "job_id": job_id, "event_type": "view", "event_metadata": {}},
            candidate_a_token,
        )
        request(
            "POST",
            "/interactions",
            {"user_id": candidate_a, "job_id": job_id, "event_type": "click", "event_metadata": {}},
            candidate_a_token,
        )
        request(
            "POST",
            "/interactions",
            {"user_id": candidate_a, "job_id": job_id, "event_type": "apply", "event_metadata": {}},
            candidate_a_token,
        )

    report = request("POST", "/evaluate", token=recruiter_token)
    print("Evaluation report:")
    print(json.dumps(report, indent=2))
    print("Demo scenario completed.")


if __name__ == "__main__":
    main()
