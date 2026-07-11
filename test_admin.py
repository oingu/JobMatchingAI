from app.database import SessionLocal
from app.models import User
from app.main import admin_stats

db = SessionLocal()
admin = db.query(User).filter(User.role == "admin").first()
if admin:
    res = admin_stats(db, admin)
    print("Baseline:", res["model_comparison"]["baseline"])
    print("Improved:", res["model_comparison"]["improved"])
    print("Delta:", res["model_comparison"]["delta"])
else:
    print("No admin user found")
