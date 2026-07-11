import sys
import os
import random

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, Job, Application, Event, CandidateProfile
from app.utils.time import now_utc

def trigger_demo():
    db = SessionLocal()
    try:
        # 1. Find Recruiter
        rec_email = "oingucoolname1@gmail.com"
        recruiter = db.query(User).filter(User.email == rec_email).first()
        if not recruiter:
            print(f"Recruiter {rec_email} not found!")
            return

        print(f"Found Recruiter: {recruiter.name} (ID: {recruiter.id})")

        # 2. Define new Jobs
        jobs_data = [
            {
                "title": "Senior React Developer",
                "location": "Hồ Chí Minh",
                "experience_level": "senior",
                "work_mode": "Hybrid",
                "required_skills": [{"name": "React", "level": 4}, {"name": "TypeScript", "level": 4}],
                "salary_min": 1500,
                "salary_max": 2500,
            },
            {
                "title": "AI/ML Engineer",
                "location": "Hà Nội",
                "experience_level": "mid",
                "work_mode": "On-site",
                "required_skills": [{"name": "Python", "level": 5}, {"name": "Machine Learning", "level": 4}, {"name": "TensorFlow", "level": 3}],
                "salary_min": 1800,
                "salary_max": 3000,
            },
            {
                "title": "Data Scientist",
                "location": "Đà Nẵng",
                "experience_level": "senior",
                "work_mode": "Remote",
                "required_skills": [{"name": "Python", "level": 5}, {"name": "SQL", "level": 4}, {"name": "Data Analysis", "level": 4}],
                "salary_min": 2000,
                "salary_max": 3500,
            },
            {
                "title": "DevOps Engineer",
                "location": "Hồ Chí Minh",
                "experience_level": "mid",
                "work_mode": "On-site",
                "required_skills": [{"name": "AWS", "level": 4}, {"name": "Docker", "level": 4}, {"name": "Kubernetes", "level": 3}],
                "salary_min": 1500,
                "salary_max": 2500,
            },
            {
                "title": "Product Manager",
                "location": "Hà Nội",
                "experience_level": "senior",
                "work_mode": "Hybrid",
                "required_skills": [{"name": "Product Management", "level": 5}, {"name": "Agile", "level": 4}, {"name": "Scrum", "level": 4}],
                "salary_min": 2000,
                "salary_max": 4000,
            }
        ]

        new_jobs = []
        for data in jobs_data:
            job = Job(
                recruiter_id=recruiter.id,
                title=data["title"],
                location=data["location"],
                experience_level=data["experience_level"],
                work_mode=data["work_mode"],
                required_skills=data["required_skills"],
                salary_min=data["salary_min"],
                salary_max=data["salary_max"]
            )
            db.add(job)
            new_jobs.append(job)
        
        db.commit()
        for job in new_jobs:
            db.refresh(job)

        print(f"Created {len(new_jobs)} new demo jobs.")

        # 3. Trigger JobCreated Events
        for job in new_jobs:
            event = Event(
                event_type="job_created",
                payload={"job_id": job.id},
                status="PENDING"
            )
            db.add(event)
        db.commit()
        print("Triggered job_created events.")

        # 4. Generate Random Applications
        # Get dataset candidates
        dataset_candidates = db.query(User).filter(User.email.like("%@dataset.local"), User.role == "candidate").all()
        demo_candidates = db.query(User).filter(User.email.in_([
            "sleepy_genius@test.com", 
            "hardworking_newbie@test.com", 
            "wrong_location_pro@test.com",
            "oingucoolname@gmail.com",
            "oingucoolname1@gmail.com"
        ]), User.role == "candidate").all()

        if not dataset_candidates:
            print("No dataset candidates found! Cannot generate random applications.")
            return

        print(f"Found {len(dataset_candidates)} dataset candidates. Simulating applications...")

        application_statuses = ["PENDING", "REVIEWED", "ACCEPTED", "REJECTED"]
        app_count = 0

        for job in new_jobs:
            # Randomly pick 5-15 candidates to apply to this job
            num_applicants = random.randint(5, 15)
            applicants = random.sample(dataset_candidates, min(num_applicants, len(dataset_candidates)))
            
            # Make sure at least one demo candidate applies to make it look cool
            if demo_candidates:
                applicants.append(random.choice(demo_candidates))
                
            for candidate in set(applicants):
                # Check if already applied
                existing_app = db.query(Application).filter(
                    Application.job_id == job.id,
                    Application.candidate_id == candidate.id
                ).first()
                if not existing_app:
                    status = random.choice(application_statuses)
                    app = Application(
                        candidate_id=candidate.id,
                        job_id=job.id,
                        status=status,
                        cover_letter=f"Hi, I am very interested in the {job.title} role." if random.random() > 0.5 else ""
                    )
                    db.add(app)
                    db.commit()
                    db.refresh(app)
                    
                    # Trigger application_submitted event
                    event = Event(
                        event_type="application_submitted",
                        payload={"application_id": app.id},
                        status="PENDING"
                    )
                    db.add(event)
                    app_count += 1

        db.commit()
        print(f"Successfully created {app_count} applications and triggered events!")
        print("Wait a few seconds for the background worker to process the events.")

    finally:
        db.close()

if __name__ == "__main__":
    trigger_demo()
