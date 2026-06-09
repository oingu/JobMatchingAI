import sys
import os

# Add root directory to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User
from app.services.security import hash_password

def main():
    db = SessionLocal()
    try:
        # Check if admin already exists
        email = "admin@example.com"
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            # If exists, make sure they are admin
            if existing.role != "admin":
                existing.role = "admin"
                db.commit()
                print(f"Updated existing user {email} to admin role.")
            else:
                print(f"Admin account already exists: {email}")
            return

        admin_user = User(
            name="System Administrator",
            email=email,
            password=hash_password("admin123"),
            role="admin",
            is_online=False,
            email_verified=True
        )
        db.add(admin_user)
        db.commit()
        print(f"Successfully created admin account: {email} / admin123")
    except Exception as e:
        print(f"Error creating admin account: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
