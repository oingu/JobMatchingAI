import sys
import os
from datetime import timedelta

# Thêm đường dẫn gốc vào sys.path để import được app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, CandidateProfile, RecruiterProfile, Job
from app.utils.time import now_utc

def seed_personas():
    db = SessionLocal()
    try:
        print("Đang tạo dữ liệu Case Study...")

        # 1. Tạo Recruiter & Job Demo
        rec_email = "demo_hr@test.com"
        recruiter = db.query(User).filter(User.email == rec_email).first()
        if not recruiter:
            recruiter = User(name="Tech HR", email=rec_email, role="recruiter")
            db.add(recruiter)
            db.commit()
            db.refresh(recruiter)
            
            rec_profile = RecruiterProfile(
                user_id=recruiter.id,
                company_name="Tech Startup Mới Nổi",
                verification_status="VERIFIED"
            )
            db.add(rec_profile)
            db.commit()

        # Job 1: Backend Engineer ở Hà Nội (On-site)
        job1 = db.query(Job).filter(Job.title == "[DEMO] Backend Engineer").first()
        if not job1:
            job1 = Job(
                recruiter_id=recruiter.id,
                title="[DEMO] Backend Engineer",
                location="Hà Nội",
                experience_level="junior",
                work_mode="On-site",
                required_skills=[{"name": "Python", "level": 4}, {"name": "FastAPI", "level": 4}]
            )
            db.add(job1)
            db.commit()
            db.refresh(job1)

        # Job 2: Backend Engineer (Remote)
        job2 = db.query(Job).filter(Job.title == "[DEMO] Remote Backend Engineer").first()
        if not job2:
            job2 = Job(
                recruiter_id=recruiter.id,
                title="[DEMO] Remote Backend Engineer",
                location="Hà Nội",
                experience_level="junior",
                work_mode="Remote",
                required_skills=[{"name": "Python", "level": 4}, {"name": "FastAPI", "level": 4}]
            )
            db.add(job2)
            db.commit()
            db.refresh(job2)

        # 2. Xóa các ứng viên demo cũ nếu có
        emails = ["sleepy_genius@test.com", "hardworking_newbie@test.com", "wrong_location_pro@test.com"]
        for email in emails:
            u = db.query(User).filter(User.email == email).first()
            if u:
                from app.models import InteractionLog, Recommendation
                db.query(InteractionLog).filter(InteractionLog.user_id == u.id).delete()
                db.query(Recommendation).filter(Recommendation.candidate_id == u.id).delete()
                db.query(CandidateProfile).filter(CandidateProfile.user_id == u.id).delete()
                db.delete(u)
        db.commit()

        # 3. Kẻ lười biếng tài năng (Sleepy Genius)
        u1 = User(name="Thiên Tài Ngủ Đông", email=emails[0], role="candidate", email_verified=True)
        db.add(u1)
        db.commit()
        db.refresh(u1)
        p1 = CandidateProfile(
            user_id=u1.id,
            skills=[{"name": "Python", "level": 5}, {"name": "FastAPI", "level": 5}],
            experience_level="junior",
            preferred_locations="Hà Nội",
            activity_score=0.0,
            last_login_at=now_utc() - timedelta(days=60),
            birth_date="1999-01-01"
        )
        db.add(p1)

        # 4. Tân binh năng nổ (Hardworking Newbie)
        u2 = User(name="Tân Binh Năng Nổ", email=emails[1], role="candidate", email_verified=True)
        db.add(u2)
        db.commit()
        db.refresh(u2)
        p2 = CandidateProfile(
            user_id=u2.id,
            skills=[{"name": "Python", "level": 2}],
            experience_level="junior",
            preferred_locations="Hà Nội",
            activity_score=1.0,
            last_login_at=now_utc(),
            birth_date="1999-01-01"
        )
        db.add(p2)

        # 5. Đúng người sai thời điểm (Wrong Location Pro)
        u3 = User(name="Chuyên Gia Sai Vị Trí", email=emails[2], role="candidate", email_verified=True)
        db.add(u3)
        db.commit()
        db.refresh(u3)
        p3 = CandidateProfile(
            user_id=u3.id,
            skills=[{"name": "Python", "level": 5}, {"name": "FastAPI", "level": 5}],
            experience_level="junior",
            preferred_locations="TP. HCM", # SAI VỊ TRÍ
            activity_score=1.0,
            last_login_at=now_utc(),
            birth_date="1999-01-01"
        )
        db.add(p3)

        db.commit()

        print("Đã tạo thành công 3 Ứng viên Case Study!")
        print("Hãy chạy lại Recommendation Engine để xem AI sẽ xếp hạng 3 người này như thế nào.")

    finally:
        db.close()

if __name__ == "__main__":
    seed_personas()
