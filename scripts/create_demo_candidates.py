import os
import random
import uuid
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import User, CandidateProfile
from app.services.security import hash_password
from app.services.events import enqueue_event

def main():
    db: Session = SessionLocal()
    
    # Base profiles info
    names = ["Nguyễn Văn", "Trần Thị", "Lê Văn", "Phạm Thị", "Hoàng Văn", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"]
    skills = ["cpp", "java", "python", "php"]
    locations = ["Hanoi", "Hà Nội", "Hanoi, Vietnam"]
    
    candidates = []
    
    for i in range(20):
        # Generate variations
        uid = uuid.uuid4().hex[:6]
        first_name = random.choice(names)
        last_name = f"Demo_{uid}"
        email = f"demo_{uid}@example.com"
        
        # Check if exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            user = existing_user
            profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user.id).first()
        else:
            user = User(
                email=email,
                password=hash_password("password123"),
                name=f"{first_name} {last_name}",
                role="candidate",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            salary = random.randint(950, 1250)
            chosen_skills = [{"name": sk, "level": random.randint(2, 4)} for sk in random.sample(skills, random.randint(1, 3))]
            
            profile = CandidateProfile(
                user_id=user.id,
                experience_level="junior",
                preferred_salary_min=salary,
                preferred_locations=random.choice(locations),
                birth_date="2000-01-01",
                bio=f"Junior developer passionate about {random.choice(skills)}.",
                skills=chosen_skills
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
            
        candidates.append(user.id)
        print(f"Prepared candidate: {user.name} ({user.email})")

    # Trigger matching
    print("Triggering matching for generated candidates...")
    for cid in candidates:
        enqueue_event(db, "candidate_profile_updated", {"candidate_id": cid})
    
    print("Matching triggered successfully for 20 candidates.")
    
if __name__ == "__main__":
    main()
