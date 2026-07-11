from app.database import SessionLocal
from app.models import Job, Event

db = SessionLocal()
# The 5 newest jobs
jobs = db.query(Job).order_by(Job.id.desc()).limit(5).all()
for job in jobs:
    event = Event(
        event_type="job_created",
        payload={"job_id": job.id},
        status="PENDING"
    )
    db.add(event)
db.commit()
print("Triggered 5 job_created events.")
