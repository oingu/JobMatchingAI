import logging
from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CandidateProfile, Notification, User
from app.services.email import build_notification_email, is_email_configured, send_email
from app.utils.time import as_utc, now_utc

logger = logging.getLogger(__name__)


def can_receive_recommendation(db: Session, user_id: int) -> bool:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    if user.role == "candidate":
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        if profile and profile.status == "INACTIVE":
            return False
        if profile and profile.status == "PASSIVE" and profile.last_notified_at:
            if now_utc() - as_utc(profile.last_notified_at) < timedelta(hours=settings.passive_throttle_hours):
                return False
    return True


def send_notification(
    db: Session,
    user_id: int,
    title: str,
    body: str,
    idempotency_key: str | None = None,
    bypass_recommendation_policy: bool = False,
) -> Notification | None:
    if idempotency_key:
        existing = db.query(Notification).filter(Notification.idempotency_key == idempotency_key).first()
        if existing:
            return existing
    if (not bypass_recommendation_policy) and (not can_receive_recommendation(db, user_id)):
        return None

    notification = Notification(
        user_id=user_id,
        title=title,
        body=body,
        idempotency_key=idempotency_key,
        status="SENT",
        created_at=now_utc(),
    )
    db.add(notification)
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
    if profile and not bypass_recommendation_policy:
        profile.no_response_streak += 1
        profile.last_notified_at = now_utc()
    try:
        db.commit()
        db.refresh(notification)
        
        # Bắn WebSocket event
        from app.services.websockets import manager
        manager.dispatch({
            "type": "new_notification",
            "notification": {
                "id": notification.id,
                "title": notification.title,
                "body": notification.body,
                "is_read": notification.status == "READ",
                "created_at": notification.created_at.isoformat()
            }
        }, user_id)
    except IntegrityError:
        db.rollback()
        if idempotency_key:
            return db.query(Notification).filter(Notification.idempotency_key == idempotency_key).first()
        return None

    # Send email only after notification is persisted to avoid duplicate
    # emails in concurrent/retry scenarios with the same idempotency key.
    user = db.query(User).filter(User.id == user_id).first()
    email_sent = False
    if user and is_email_configured():
        text, html = build_notification_email(title, body)
        email_sent = send_email(user.email, f"[JobMatch AI] {title}", text, html)
    if email_sent:
        notification.status = "EMAIL_SENT"
        db.commit()
        db.refresh(notification)
    return notification
