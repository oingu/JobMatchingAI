from app.database import SessionLocal
from app.models import Job, Event
from app.services.recommendation import rank_candidates_for_job, persist_recommendations

db = SessionLocal()

# 1. Create a dummy event to serve as source_event_id
dummy_event = Event(event_type="system_update", payload={}, status="DONE")
db.add(dummy_event)
db.commit()
db.refresh(dummy_event)

jobs = db.query(Job).all()
for job in jobs:
    print(f"Ranking candidates for job {job.id}")
    top_scores = rank_candidates_for_job(db, job, top_k=200)
    persist_recommendations(db, source_event_id=dummy_event.id, scores=top_scores, replace_for_job=job.id)

db.commit()
print("Done re-ranking!")
