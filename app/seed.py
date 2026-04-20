from app.database import Base, SessionLocal, engine
from app.models import User


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            return
        db.add_all(
            [
                User(name="Recruiter One", email="recruiter1@example.com", role="recruiter", is_online=False),
                User(name="Candidate One", email="candidate1@example.com", role="candidate", is_online=False),
                User(name="Candidate Two", email="candidate2@example.com", role="candidate", is_online=True),
            ]
        )
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("Seed completed.")
