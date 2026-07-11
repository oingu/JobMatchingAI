from app.database import SessionLocal
from app.models import User
from app.main import candidate_feed
db = SessionLocal()
user = db.query(User).filter(User.id == 338).first()
res = candidate_feed(candidate_id=338, top_k=5, db=db, current_user=user)
print("Returned items:", len(res["data"]["items"]))
for item in res["data"]["items"]:
    print(item["job_title"])
