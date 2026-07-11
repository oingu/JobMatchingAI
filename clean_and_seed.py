from app.database import SessionLocal
from app.models import InteractionLog, Recommendation, Event, User, Job, CandidateProfile, RecruiterProfile, Application, ApplicationMessage, Interview, Notification

db = SessionLocal()

print("Deleting child records...")
db.query(InteractionLog).delete()
db.query(Recommendation).delete()
db.query(Event).delete()
db.query(ApplicationMessage).delete()
db.query(Interview).delete()
db.query(Notification).delete()
db.query(Application).delete()

print("Deleting previously generated dataset users and jobs...")
# Delete jobs created by dataset recruiters
generated_recruiters = db.query(User).filter(User.email.like("%@dataset.local"), User.role == "recruiter").all()
for r in generated_recruiters:
    db.query(Job).filter(Job.recruiter_id == r.id).delete()

db.query(CandidateProfile).filter(CandidateProfile.user_id.in_(db.query(User.id).filter(User.email.like("%@dataset.local")))).delete(synchronize_session=False)
db.query(RecruiterProfile).filter(RecruiterProfile.user_id.in_(db.query(User.id).filter(User.email.like("%@dataset.local")))).delete(synchronize_session=False)

db.query(User).filter(User.email.like("%@dataset.local")).delete(synchronize_session=False)

db.commit()
print("Cleaned up! Remaining users:", db.query(User).count())
