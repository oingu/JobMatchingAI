import math

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CandidateProfile, InteractionLog, User
from app.utils.time import as_utc, now_utc


def compute_activity_score(days_since_last_login: int, click_count: int, apply_count: int) -> float:
    decay = math.exp(-settings.behavior_lambda * max(days_since_last_login, 0))
    engagement_boost = min(1.0, (0.1 * click_count) + (0.2 * apply_count))
    return min(1.0, (0.7 * decay) + (0.3 * engagement_boost))


def determine_status(score: float, no_response_streak: int) -> str:
    # Explicitly encode N-times non-response policy from requirements.
    if no_response_streak >= settings.behavior_inactive_streak:
        return "INACTIVE"
    if no_response_streak >= settings.behavior_passive_streak:
        return "PASSIVE"
    if score < 0.2:
        return "INACTIVE"
    if score < 0.5:
        return "PASSIVE"
    return "ACTIVE"


def update_user_behavior_state(db: Session, candidate_user_id: int) -> CandidateProfile | None:
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_user_id).first()
    if not profile:
        return None

    last_login = (
        db.query(InteractionLog)
        .filter(InteractionLog.user_id == candidate_user_id, InteractionLog.event_type == "login")
        .order_by(desc(InteractionLog.created_at))
        .first()
    )
    now = now_utc()
    last_login_time = last_login.created_at if last_login else profile.last_login_at
    days_since = (now - as_utc(last_login_time)).days

    click_count = (
        db.query(InteractionLog)
        .filter(InteractionLog.user_id == candidate_user_id, InteractionLog.event_type == "click")
        .count()
    )
    apply_count = (
        db.query(InteractionLog)
        .filter(InteractionLog.user_id == candidate_user_id, InteractionLog.event_type == "apply")
        .count()
    )

    score = compute_activity_score(days_since, click_count, apply_count)
    profile.activity_score = score
    profile.status = determine_status(score, profile.no_response_streak)
    profile.updated_at = now
    db.commit()
    db.refresh(profile)
    return profile


def update_all_candidates_behavior(db: Session) -> int:
    candidates = db.query(User).filter(User.role == "candidate").all()
    updated = 0
    for candidate in candidates:
        profile = update_user_behavior_state(db, candidate.id)
        if profile:
            updated += 1
    return updated


def reset_no_response_streak(db: Session, candidate_user_id: int) -> None:
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_user_id).first()
    if not profile:
        return
    profile.no_response_streak = 0
    profile.updated_at = now_utc()
    db.commit()
