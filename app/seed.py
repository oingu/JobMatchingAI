from app.database import Base, SessionLocal, engine
from app.models import CandidateProfile, RecruiterProfile, User
from app.services.security import hash_password


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            return

        hashed_pw = hash_password("changeme")
        
        # 1. Create Users
        admin = User(name="Admin", email="admin@example.com", role="admin", password=hashed_pw, email_verified=True, is_online=False)
        recruiter = User(name="Recruiter One", email="recruiter1@example.com", role="recruiter", password=hashed_pw, email_verified=True, is_online=False)
        candidate1 = User(name="Candidate One", email="candidate1@example.com", role="candidate", password=hashed_pw, email_verified=True, is_online=False)
        candidate2 = User(name="Candidate Two", email="candidate2@example.com", role="candidate", password=hashed_pw, email_verified=True, is_online=True)
        
        db.add_all([admin, recruiter, candidate1, candidate2])
        db.commit()

        # 2. Create Profiles for functional UI
        recruiter_profile = RecruiterProfile(
            user_id=recruiter.id,
            company_name="Tech Corp Demo",
            company_website="https://techcorp.example.com",
            verification_status="VERIFIED"
        )
        c1_profile = CandidateProfile(
            user_id=candidate1.id,
            skills=[{"name": "Python", "level": 4}, {"name": "React", "level": 3}],
            experience_level="mid-level",
            preferred_locations="Hanoi, Remote",
            preferred_salary_min=1000
        )
        c2_profile = CandidateProfile(
            user_id=candidate2.id,
            skills=[{"name": "Java", "level": 5}, {"name": "SQL", "level": 4}],
            experience_level="senior",
            preferred_locations="Ho Chi Minh",
            preferred_salary_min=2000
        )
        
        db.add_all([recruiter_profile, c1_profile, c2_profile])
        db.commit()

    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("Seed completed.")
