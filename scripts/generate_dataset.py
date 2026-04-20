"""
Generate synthetic dataset directly into local SQLite DB for evaluation.

Usage:
  python scripts/generate_dataset.py
"""

from __future__ import annotations

import sys
import random
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import Base, SessionLocal, engine
from app.models import CandidateProfile, InteractionLog, Job, RecruiterProfile, User
from app.utils.time import now_utc

SKILLS = [
    "python",
    "sql",
    "fastapi",
    "java",
    "spring",
    "javascript",
    "react",
    "docker",
    "kafka",
]
LOCATIONS = ["hanoi", "hcm", "danang"]
LEVELS = ["junior", "middle", "senior"]


def sample_skills(min_k: int = 2, max_k: int = 4) -> str:
    k = random.randint(min_k, max_k)
    return ",".join(random.sample(SKILLS, k))


def main() -> None:
    random.seed(42)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        recruiters = []
        candidates = []

        for i in range(5):
            user = User(
                name=f"Recruiter {i + 1}",
                email=f"recruiter{i + 1}@dataset.local",
                password="secret123",
                role="recruiter",
                is_online=bool(i % 2),
            )
            db.add(user)
            db.flush()
            db.add(RecruiterProfile(user_id=user.id, company_name=f"Company {i + 1}", updated_at=now_utc()))
            recruiters.append(user)

        for i in range(40):
            user = User(
                name=f"Candidate {i + 1}",
                email=f"candidate{i + 1}@dataset.local",
                password="secret123",
                role="candidate",
                is_online=bool(i % 3 == 0),
            )
            db.add(user)
            db.flush()
            db.add(
                CandidateProfile(
                    user_id=user.id,
                    skills=sample_skills(),
                    experience_level=random.choice(LEVELS),
                    preferred_locations=random.choice(LOCATIONS),
                    preferred_salary_min=random.randint(700, 2000),
                    activity_score=random.uniform(0.2, 1.0),
                    status="ACTIVE",
                    last_login_at=now_utc() - timedelta(days=random.randint(0, 45)),
                    updated_at=now_utc(),
                )
            )
            candidates.append(user)

        for i in range(30):
            recruiter = random.choice(recruiters)
            db.add(
                Job(
                    recruiter_id=recruiter.id,
                    title=f"Job {i + 1}",
                    required_skills=sample_skills(),
                    location=random.choice(LOCATIONS),
                    salary_min=random.randint(700, 1500),
                    salary_max=random.randint(1600, 3200),
                    experience_level=random.choice(LEVELS),
                )
            )

        db.commit()

        # Add historical interactions for engagement metrics.
        jobs = db.query(Job).all()
        for user in candidates:
            for _ in range(random.randint(2, 10)):
                job = random.choice(jobs)
                db.add(
                    InteractionLog(
                        user_id=user.id,
                        job_id=job.id,
                        event_type=random.choice(["view", "click", "apply"]),
                        event_metadata={},
                        created_at=now_utc() - timedelta(days=random.randint(0, 30)),
                    )
                )
        db.commit()
        print("Synthetic dataset generated.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
