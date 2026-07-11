import sys
import os
import csv
import random

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, Base, engine
from app.models import User, Job, CandidateProfile, RecruiterProfile, InteractionLog
from app.utils.time import now_utc

VN_PROVINCES = [
    "Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ",
    "Bình Dương", "Đồng Nai", "Bắc Ninh", "Vũng Tàu", "Khánh Hòa",
    "Thừa Thiên Huế", "Quảng Ninh", "Nghệ An", "Thanh Hóa", "Hải Dương"
]

def load_dataset():
    csv_file = os.path.join(os.path.dirname(__file__), "huge_job_recommendation_dataset.csv")
    if not os.path.exists(csv_file):
        print(f"File not found: {csv_file}")
        return

    db = SessionLocal()
    try:
        user_map = {}
        job_map = {}

        print("Đang đọc file dataset (giới hạn 50,000 dòng để tránh overload DB)...")
        rows = []
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i >= 50000:
                    break
                rows.append(row)

        print("Đang trích xuất Users và Jobs...")
        unique_users = {}
        unique_jobs = {}
        for row in rows:
            uid = row["user_id"]
            if uid not in unique_users:
                unique_users[uid] = {
                    "skills": row["user_skills"],
                    "location": random.choice(VN_PROVINCES),
                    "education": row["education"],
                    "experience": row["experience"]
                }
            
            jid = row["job_id"]
            if jid not in unique_jobs:
                unique_jobs[jid] = {
                    "title": row["title"],
                    "description": row["description"],
                    "skills_required": row["skills_required"],
                    "location": random.choice(VN_PROVINCES)
                }

        # Recruiter
        rec_email = "kaggle_hr@dataset.local"
        recruiter = db.query(User).filter(User.email == rec_email).first()
        if not recruiter:
            recruiter = User(name="Kaggle HR", email=rec_email, role="recruiter")
            db.add(recruiter)
            db.commit()
            db.refresh(recruiter)
            db.add(RecruiterProfile(user_id=recruiter.id, company_name="Kaggle Global"))
            db.commit()

        import time
        run_id = int(time.time())
        print("Đang Insert Candidates...")
        for count, (uid, data) in enumerate(unique_users.items()):
            u = User(name=f"Candidate {uid}", email=f"cand_{uid}_{run_id}@kaggle.local", role="candidate")
            db.add(u)
            db.flush()
            
            skills_list = []
            for s in data["skills"].split(";"):
                s = s.strip()
                if s:
                    skills_list.append({"name": s, "level": random.randint(3, 5)})

            profile = CandidateProfile(
                user_id=u.id,
                skills=skills_list,
                preferred_locations=data["location"],
                experience_level="mid" if "0" not in data["experience"] else "junior"
            )
            db.add(profile)
            user_map[uid] = u.id
            if count % 1000 == 0:
                print(f"  Inserted {count} candidates...")
                db.commit()

        db.commit()
        print(f"Đã import tổng cộng {len(user_map)} ứng viên.")

        print("Đang Insert Jobs...")
        for count, (jid, data) in enumerate(unique_jobs.items()):
            skills_req = []
            for s in data["skills_required"].split(";"):
                s = s.strip()
                if s:
                    skills_req.append({"name": s, "level": random.randint(2, 5)})
            
            job = Job(
                recruiter_id=recruiter.id,
                title=data["title"],
                brief_description=data["description"][:1000],
                location=data["location"],
                required_skills=skills_req,
                experience_level="junior"
            )
            db.add(job)
            db.flush()
            job_map[jid] = job.id
            if count % 1000 == 0:
                print(f"  Inserted {count} jobs...")
                db.commit()
            
        db.commit()
        print(f"Đã import tổng cộng {len(job_map)} công việc.")

        print("Đang Import Interaction Logs...")
        for count, row in enumerate(rows):
            uid = row["user_id"]
            jid = row["job_id"]
            score = float(row["relevance_score"])
            
            action = "view"
            if score >= 0.7:
                action = "apply"
            elif score >= 0.4:
                action = "click"

            log = InteractionLog(
                user_id=user_map[uid],
                job_id=job_map[jid],
                event_type=action,
                event_metadata={"score": score}
            )
            db.add(log)
            if count % 5000 == 0:
                print(f"  Inserted {count} interaction logs...")
                db.commit()
        
        db.commit()
        print(f"Đã import tổng cộng {len(rows)} tương tác.")
        print("HOÀN TẤT!")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    load_dataset()
