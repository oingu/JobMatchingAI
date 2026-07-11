import os
os.environ["MATCHING_STRATEGY"] = "proficiency"
os.environ["DATABASE_URL"] = "sqlite:///./benchmark.db"

from app.database import SessionLocal
from app.models import Job
from app.services.recommendation import rank_candidates_for_job

db = SessionLocal()
job = db.query(Job).first()
if job:
    print(job.title)
    res = rank_candidates_for_job(db, job)
    print("Candidates:", len(res))
else:
    print("No job")
