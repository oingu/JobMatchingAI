from app.database import SessionLocal
from app.models import User
db = SessionLocal()
users = db.query(User).all()
for u in users:
    if "@dataset.local" not in u.email:
        print(f"ID: {u.id}, Name: {u.name}, Email: {u.email}, Role: {u.role}")
