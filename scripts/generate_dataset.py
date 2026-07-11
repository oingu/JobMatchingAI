"""
Generate synthetic dataset directly into local SQLite DB for evaluation.

Creates a fresh database with:
- 10 recruiters with company profiles
- 150 candidates with skill vectors (proficiency 1-5)
- 60 jobs with required skill vectors
- 1500+ interaction logs (view/click/apply/login)
- Realistic apply patterns so Precision/Recall metrics are meaningful

Usage:
  python scripts/generate_dataset.py
"""

from __future__ import annotations

import os
import sys
import random
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Force fast local matching during dataset generation (no API calls)
os.environ["MATCHING_STRATEGY"] = "proficiency"
# Disable email sending to prevent spam during dataset generation
os.environ["SMTP_HOST"] = ""
os.environ["SMTP_USER"] = ""
os.environ["SMTP_PASS"] = ""

from app.database import Base, SessionLocal, engine
from app.models import CandidateProfile, Event, InteractionLog, Job, RecruiterProfile, User
from app.services.events import enqueue_event
from app.utils.time import now_utc

SKILLS = [
    "python", "sql", "fastapi", "java", "spring", "javascript", "react",
    "docker", "kafka", "kubernetes", "typescript", "node.js", "django",
    "postgresql", "redis", "go", "c++", "aws", "git", "linux",
    "mongodb", "flask", "angular", "vue", "tensorflow", "pytorch",
    "elasticsearch", "graphql", "ci/cd", "agile",
]
LOCATIONS = ["hanoi", "hcm", "danang", "remote", "hai phong"]
LEVELS = ["junior", "middle", "senior"]
JOB_TITLES = [
    "Backend Engineer", "Frontend Developer", "Fullstack Developer",
    "Data Engineer", "ML Engineer", "DevOps Engineer", "QA Engineer",
    "Mobile Developer", "Cloud Architect", "Software Architect",
    "Site Reliability Engineer", "Security Engineer",
]


def sample_skills_json(min_k: int = 2, max_k: int = 5) -> list[dict]:
    """Return JSON skill list [{name, level}] matching the data model."""
    k = random.randint(min_k, max_k)
    return [
        {"name": skill, "level": random.randint(1, 5)}
        for skill in random.sample(SKILLS, k)
    ]


def main() -> None:
    import uuid
    run_id = str(uuid.uuid4())[:6]
    random.seed(42)

    from app.config import settings
    # Commented out to append to existing DB
    # db_url = settings.database_url
    # if db_url.startswith("sqlite:///./"):
    #     db_path = ROOT / db_url.replace("sqlite:///./", "")
    #     if db_path.exists():
    #         os.remove(db_path)
    #         print(f"Removed existing {db_path}")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        recruiters = []
        candidates = []

        # --- Recruiters ---
        for i in range(10):
            user = User(
                name=f"Recruiter {i + 1} ({run_id})",
                email=f"recruiter{i + 1}_{run_id}@dataset.local",
                password="secret123",
                role="recruiter",
                is_online=bool(i % 2),
            )
            db.add(user)
            db.flush()
            db.add(RecruiterProfile(
                user_id=user.id,
                company_name=f"Company {i + 1} ({run_id})",
                company_website=f"https://company{i+1}-{run_id}.com",
                updated_at=now_utc(),
            ))
            recruiters.append(user)

        # --- Candidates ---
        for i in range(150):
            days_ago = random.randint(0, 60)
            status = "ACTIVE"
            activity = random.uniform(0.3, 1.0)
            if days_ago > 40:
                status = random.choice(["PASSIVE", "INACTIVE"])
                activity = random.uniform(0.05, 0.3)
            elif days_ago > 20:
                status = random.choice(["ACTIVE", "PASSIVE"])
                activity = random.uniform(0.2, 0.6)

            user = User(
                name=f"Candidate {i + 1} ({run_id})",
                email=f"candidate{i + 1}_{run_id}@dataset.local",
                password="secret123",
                role="candidate",
                is_online=bool(i % 4 == 0),
            )
            db.add(user)
            db.flush()
            db.add(
                CandidateProfile(
                    user_id=user.id,
                    skills=sample_skills_json(2, 6),
                    experience_level=random.choice(LEVELS),
                    preferred_locations=random.choice(LOCATIONS),
                    preferred_salary_min=random.randint(500, 2500),
                    activity_score=round(activity, 3),
                    status=status,
                    birth_date=f"200{random.randint(0, 5)}-01-01",
                    no_response_streak=random.randint(0, 8) if status != "ACTIVE" else random.randint(0, 2),
                    last_login_at=now_utc() - timedelta(days=days_ago),
                    updated_at=now_utc(),
                )
            )
            candidates.append(user)

        # --- Jobs ---
        jobs = []
        for i in range(60):
            recruiter = random.choice(recruiters)
            job = Job(
                recruiter_id=recruiter.id,
                title=f"{random.choice(JOB_TITLES)} #{i + 1}",
                brief_description=f"Looking for talented engineers. Position {i+1}.",
                required_skills=sample_skills_json(2, 5),
                location=random.choice(LOCATIONS),
                salary_min=random.randint(500, 1500),
                salary_max=random.randint(1600, 4000),
                experience_level=random.choice(LEVELS),
            )
            db.add(job)
            jobs.append(job)

        db.commit()
        # Refresh to get IDs
        for j in jobs:
            db.refresh(j)

        # --- Interactions (realistic patterns) ---
        # Each candidate views several jobs, clicks some, applies to fewer
        from app.services.recommendation import preference_match
        interaction_count = 0
        for user in candidates:
            profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user.id).first()
            
            # Fast proxy for ranking: sort jobs by preference match
            scored_jobs = []
            for job in jobs:
                p_match = preference_match(profile, job)
                # Randomize skill match slightly for simulation
                s_match = random.uniform(0.5, 1.0)
                base_score = 0.7 * s_match + 0.3 * p_match
                scored_jobs.append((job, base_score))
            
            scored_jobs.sort(key=lambda x: x[1], reverse=True)
            top_jobs = [j for j, _ in scored_jobs[:20]]
            
            n_views = random.randint(3, 10)
            viewed_jobs = random.sample(top_jobs, min(n_views, len(top_jobs)))
            
            for job in viewed_jobs:
                db.add(InteractionLog(
                    user_id=user.id,
                    job_id=job.id,
                    event_type="view",
                    event_metadata={},
                    created_at=now_utc() - timedelta(days=random.randint(0, 30)),
                ))
                interaction_count += 1

                # Click chance heavily depends on activity score
                click_prob = 0.1 + (profile.activity_score * 0.7)
                if random.random() < click_prob:
                    db.add(InteractionLog(
                        user_id=user.id,
                        job_id=job.id,
                        event_type="click",
                        event_metadata={},
                        created_at=now_utc() - timedelta(days=random.randint(0, 25)),
                    ))
                    interaction_count += 1

                    # Apply chance also heavily depends on activity score
                    apply_prob = 0.1 + (profile.activity_score * 0.8)
                    if random.random() < apply_prob:
                        db.add(InteractionLog(
                            user_id=user.id,
                            job_id=job.id,
                            event_type="apply",
                            event_metadata={},
                            created_at=now_utc() - timedelta(days=random.randint(0, 20)),
                        ))
                        interaction_count += 1

            # Login events proportional to activity
            for _ in range(int(profile.activity_score * 10) + 1):
                db.add(InteractionLog(
                    user_id=user.id,
                    job_id=None,
                    event_type="login",
                    event_metadata={},
                    created_at=now_utc() - timedelta(days=random.randint(0, 30)),
                ))
                interaction_count += 1

        db.commit()

        # --- Trigger matching events for all jobs ---
        event_count = 0
        for job in jobs:
            db.refresh(job)
            enqueue_event(db, "job_created", {
                "job_id": job.id,
                "recruiter_id": job.recruiter_id,
                "timestamp": now_utc().isoformat(),
            })
            event_count += 1

        print(f"\n✅ Synthetic dataset generated successfully!")
        print(f"   Recruiters:    {len(recruiters)}")
        print(f"   Candidates:    {len(candidates)}")
        print(f"   Jobs:          {len(jobs)}")
        print(f"   Interactions:  {interaction_count}")
        print(f"   Events:        {event_count}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
