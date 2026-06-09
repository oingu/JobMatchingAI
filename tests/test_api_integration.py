from fastapi.testclient import TestClient

from app.database import Base, engine, SessionLocal
from app.models import User
from app.main import app


def setup_function() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def _create_user(client: TestClient, name: str, email: str, role: str) -> int:
    response = client.post(
        "/users",
        json={"name": name, "email": email, "password": "secret123", "role": role, "is_online": False},
    )
    assert response.status_code == 200
    return int(response.json()["data"]["id"])


def _login(client: TestClient, email: str) -> str:
    response = client.post("/auth/login", json={"email": email, "password": "secret123"})
    assert response.status_code == 200
    return response.json()["data"]["token"]


def test_auth_rbac_and_pagination_flow() -> None:
    client = TestClient(app)

    recruiter_id = _create_user(client, "Recruiter", "recruiter-int@test.com", "recruiter")
    candidate_id = _create_user(client, "Candidate", "candidate-int@test.com", "candidate")

    # Verify emails directly in DB for integration testing
    db = SessionLocal()
    try:
        db.query(User).filter(User.id.in_([recruiter_id, candidate_id])).update({"email_verified": True}, synchronize_session=False)
        db.commit()
    finally:
        db.close()

    recruiter_token = _login(client, "recruiter-int@test.com")
    candidate_token = _login(client, "candidate-int@test.com")

    # Candidate cannot access recruiter dashboard.
    forbidden = client.get(
        f"/dashboard/recruiter/{recruiter_id}",
        headers={"Authorization": f"Bearer {candidate_token}"},
    )
    assert forbidden.status_code == 403

    # Build profile data and create one job.
    r_profile = client.post(
        "/recruiter-profiles",
        json={"user_id": recruiter_id, "company_name": "Acme"},
        headers={"Authorization": f"Bearer {recruiter_token}"},
    )
    assert r_profile.status_code == 200

    c_profile = client.post(
        "/candidate-profiles",
        json={
            "user_id": candidate_id,
            "skills": [{"name": "python", "level": 4}, {"name": "sql", "level": 3}],
            "experience_level": "junior",
            "preferred_locations": ["hanoi"],
            "preferred_salary_min": 900,
        },
        headers={"Authorization": f"Bearer {candidate_token}"},
    )
    assert c_profile.status_code == 200

    job = client.post(
        "/jobs",
        json={
            "recruiter_id": recruiter_id,
            "title": "Backend",
            "required_skills": [{"name": "python", "level": 3}],
            "location": "hanoi",
            "salary_min": 1000,
            "salary_max": 2000,
            "experience_level": "junior",
        },
        headers={"Authorization": f"Bearer {recruiter_token}"},
    )
    assert job.status_code == 200

    # Process events synchronously for deterministic test.
    process = client.post("/events/process?limit=20", headers={"Authorization": f"Bearer {recruiter_token}"})
    assert process.status_code == 200

    feed = client.get(
        f"/feed/candidate/{candidate_id}?offset=0&limit=5",
        headers={"Authorization": f"Bearer {candidate_token}"},
    )
    assert feed.status_code == 200
    assert isinstance(feed.json()["data"]["items"], list)

    events = client.get("/events?status=DONE&offset=0&limit=10", headers={"Authorization": f"Bearer {recruiter_token}"})
    assert events.status_code == 200
    assert len(events.json()["data"]) >= 1

    audit_logs = client.get("/audit-logs?offset=0&limit=10", headers={"Authorization": f"Bearer {recruiter_token}"})
    assert audit_logs.status_code == 200
    assert "data" in audit_logs.json()

    bad_login = client.post("/auth/login", json={"email": "candidate-int@test.com", "password": "wrong"})
    assert bad_login.status_code == 401
    assert "error" in bad_login.json()
