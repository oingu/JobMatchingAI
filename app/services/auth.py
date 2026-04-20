import secrets
from datetime import timedelta

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import AuthToken, User
from app.services.security import verify_password
from app.utils.time import as_utc, now_utc

auth_scheme = HTTPBearer(auto_error=False)


def issue_token(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = now_utc() + timedelta(minutes=settings.token_expire_minutes)
    db.add(AuthToken(user_id=user.id, token=token, expires_at=expires_at))
    db.commit()
    return token


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token.")
    token_row = db.query(AuthToken).filter(AuthToken.token == credentials.credentials).first()
    if not token_row:
        raise HTTPException(status_code=401, detail="Invalid token.")
    if as_utc(token_row.expires_at) < now_utc():
        db.delete(token_row)
        db.commit()
        raise HTTPException(status_code=401, detail="Token expired.")
    user = db.query(User).filter(User.id == token_row.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


def require_role(current_user: User, role: str, *, verified: bool = True) -> None:
    if current_user.role != role:
        raise HTTPException(status_code=403, detail=f"Forbidden. Required role: {role}")
    if verified and not current_user.email_verified and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Please verify your email before using this feature.")


def require_verified(current_user: User) -> None:
    if not current_user.email_verified:
        raise HTTPException(status_code=403, detail="Please verify your email before using this feature.")
