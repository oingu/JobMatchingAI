from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Application, CandidateProfile, Event, Job, RecruiterProfile, User
from app.services.email_tracking import build_email_click_tracking_url
from app.services.notifications import send_notification
from app.services.recommendation import persist_recommendations, rank_candidates_for_job, rank_jobs_for_candidate
from app.utils.time import now_utc

MAX_RETRY = settings.max_event_retry
NOTIF_THRESHOLD = settings.notification_score_threshold


def _candidate_contact_block(candidate: User) -> str:
    return (
        f"Candidate: {candidate.name}\n"
        f"Email: {candidate.email or 'N/A'}\n"
        f"Phone: {candidate.phone or 'N/A'}\n"
        f"DOB: {candidate.date_of_birth or 'N/A'}"
    )


def _candidate_profile_block(profile: CandidateProfile | None) -> str:
    if not profile:
        return "Experience: N/A\nPreferred locations: N/A\nPreferred salary min: N/A\nTop skills: N/A"
    skills = profile.skills or []
    top_skills = ", ".join(
        [f"{s.get('name', '')}(Lv.{s.get('level', '')})" for s in skills[:5] if s.get("name")]
    ) or "N/A"
    return (
        f"Experience: {profile.experience_level or 'N/A'}\n"
        f"Preferred locations: {profile.preferred_locations or 'N/A'}\n"
        f"Preferred salary min: {profile.preferred_salary_min or 0}\n"
        f"Top skills: {top_skills}"
    )


def _job_summary_block(job: Job) -> str:
    return (
        f"Job: {job.title}\n"
        f"Location: {job.location or 'N/A'}\n"
        f"Salary range: {job.salary_min or 0} - {job.salary_max or 0}\n"
        f"Required level: {job.experience_level or 'N/A'}"
    )


def _company_contact_block(
    db: Session,
    recruiter_id: int,
    recruiter_name: str,
    website_override: str | None = None,
) -> str:
    recruiter_profile = (
        db.query(RecruiterProfile).filter(RecruiterProfile.user_id == recruiter_id).first()
    )
    company_name = (
        recruiter_profile.company_name if recruiter_profile and recruiter_profile.company_name else recruiter_name
    )
    company_phone = recruiter_profile.company_phone if recruiter_profile else ""
    company_website = website_override if website_override is not None else (recruiter_profile.company_website if recruiter_profile else "")
    return (
        f"Company: {company_name}\n"
        f"Contact: {company_phone or 'N/A'}\n"
        f"Website: {company_website or 'N/A'}"
    )


def enqueue_event(db: Session, event_type: str, payload: dict) -> Event:
    event = Event(
        event_type=event_type,
        payload=payload,
        status="PENDING",
        retry_count=0,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    _auto_process(db, event)
    return event


def _auto_process(db: Session, event: Event) -> None:
    """Process the event immediately after creation."""
    try:
        if event.event_type == "job_created":
            _process_job_created(db, event)
        elif event.event_type == "candidate_profile_updated":
            _process_candidate_profile_updated(db, event)
        elif event.event_type == "candidate_applied":
            _process_candidate_applied(db, event)
        elif event.event_type == "application_reviewed":
            _process_application_reviewed(db, event)
        else:
            return
        event.status = "DONE"
        event.updated_at = now_utc()
        event.last_error = ""
    except Exception as exc:  # pylint: disable=broad-except
        db.rollback()
        event.retry_count += 1
        event.last_error = str(exc)
        event.updated_at = now_utc()
        event.status = "FAILED" if event.retry_count >= MAX_RETRY else "PENDING"
    db.commit()
    db.refresh(event)


def _process_job_created(db: Session, event: Event) -> None:
    job_id = event.payload["job_id"]
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return
    top_scores = rank_candidates_for_job(db, job, top_k=5)
    persist_recommendations(
        db, source_event_id=event.id, scores=top_scores,
        replace_for_job=job.id,
    )

    recruiter = db.query(User).filter(User.id == job.recruiter_id).first()
    recruiter_name = recruiter.name if recruiter else "Recruiter"
    recruiter_summary_lines: list[str] = []

    for score in top_scores:
        if score.final_score < NOTIF_THRESHOLD:
            continue
        candidate = db.query(User).filter(User.id == score.candidate_id).first()
        if candidate:
            recruiter_summary_lines.append(
                f"- {candidate.name} | score {score.final_score:.3f} | {candidate.email or 'N/A'} | {candidate.phone or 'N/A'}"
            )
        if candidate and not candidate.is_online:
            recruiter_profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == job.recruiter_id).first()
            website = recruiter_profile.company_website if recruiter_profile else ""
            if website:
                target_url = website if website.startswith(("http://", "https://")) else f"https://{website}"
                tracked_url = build_email_click_tracking_url(
                    candidate_id=candidate.id,
                    job_id=job.id,
                    target_url=target_url,
                )
                tracked_website = f"[{website}]({tracked_url})"
            else:
                tracked_website = None
            send_notification(
                db,
                user_id=candidate.id,
                title=f"New matching job: {job.title}",
                body=(
                    f"Score: {score.final_score:.3f}. A job may match your profile.\n\n"
                    f"Job: {job.title}\n"
                    f"{_company_contact_block(db, job.recruiter_id, recruiter_name, website_override=tracked_website)}"
                ),
                idempotency_key=f"job_created:{event.id}:candidate:{candidate.id}:job:{job.id}",
            )

    if recruiter and (not recruiter.is_online) and recruiter_summary_lines:
        send_notification(
            db,
            user_id=recruiter.id,
            title=f"Candidates matched your new job: {job.title}",
            body=(
                f"Top matched candidates (threshold {NOTIF_THRESHOLD:.2f}):\n"
                + "\n".join(recruiter_summary_lines[:5])
                + f"\n\n{_job_summary_block(job)}"
            ),
            idempotency_key=f"job_created:{event.id}:recruiter:{recruiter.id}:job:{job.id}",
        )


def _process_candidate_profile_updated(db: Session, event: Event) -> None:
    candidate_id = event.payload["candidate_id"]
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_id).first()
    if not profile:
        return
    top_scores = rank_jobs_for_candidate(db, profile, top_k=5)
    persist_recommendations(
        db, source_event_id=event.id, scores=top_scores,
        replace_for_candidate=candidate_id,
    )

    recruiters_notified: set[int] = set()
    candidate_best_job: Job | None = None
    candidate_best_score: float = -1.0
    candidate = db.query(User).filter(User.id == candidate_id).first()
    if not candidate:
        return
    candidate_profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_id).first()
    for score in top_scores:
        if score.final_score < NOTIF_THRESHOLD:
            continue
        job = db.query(Job).filter(Job.id == score.job_id).first()
        if not job:
            continue
        if score.final_score > candidate_best_score:
            candidate_best_score = score.final_score
            candidate_best_job = job
        recruiter = db.query(User).filter(User.id == job.recruiter_id).first()
        if recruiter and not recruiter.is_online and recruiter.id not in recruiters_notified:
            send_notification(
                db,
                user_id=recruiter.id,
                title="New candidate matched your jobs",
                body=(
                    f"Candidate matched your post.\n"
                    f"Best score: {score.final_score:.3f}\n\n"
                    f"{_job_summary_block(job)}\n\n"
                    f"{_candidate_contact_block(candidate)}\n"
                    f"{_candidate_profile_block(candidate_profile)}"
                ),
                idempotency_key=f"candidate_profile_updated:{event.id}:recruiter:{recruiter.id}:candidate:{candidate_id}",
            )
            recruiters_notified.add(recruiter.id)

    # Also notify candidate side when profile update triggers fresh matching.
    if candidate_best_job and candidate_best_score >= NOTIF_THRESHOLD and not candidate.is_online:
        best_recruiter = db.query(User).filter(User.id == candidate_best_job.recruiter_id).first()
        best_recruiter_name = best_recruiter.name if best_recruiter else "Recruiter"
        recruiter_profile = (
            db.query(RecruiterProfile).filter(RecruiterProfile.user_id == candidate_best_job.recruiter_id).first()
        )
        website = recruiter_profile.company_website if recruiter_profile else ""
        if website:
            target_url = website if website.startswith(("http://", "https://")) else f"https://{website}"
            tracked_url = build_email_click_tracking_url(
                candidate_id=candidate.id,
                job_id=candidate_best_job.id,
                target_url=target_url,
            )
            tracked_website = f"[{website}]({tracked_url})"
        else:
            tracked_website = None
        send_notification(
            db,
            user_id=candidate.id,
            title=f"New matching job: {candidate_best_job.title}",
            body=(
                f"Best score: {candidate_best_score:.3f}\n\n"
                f"{_job_summary_block(candidate_best_job)}\n"
                f"{_company_contact_block(db, candidate_best_job.recruiter_id, best_recruiter_name, website_override=tracked_website)}"
            ),
            idempotency_key=f"candidate_profile_updated:{event.id}:candidate:{candidate.id}:job:{candidate_best_job.id}",
        )


def _process_candidate_applied(db: Session, event: Event) -> None:
    application_id = event.payload.get("application_id")
    candidate_id = event.payload["candidate_id"]
    job_id = event.payload["job_id"]
    recruiter_id = event.payload["recruiter_id"]

    candidate = db.query(User).filter(User.id == candidate_id).first()
    job = db.query(Job).filter(Job.id == job_id).first()
    recruiter = db.query(User).filter(User.id == recruiter_id).first()
    if not candidate or not job or not recruiter:
        return

    candidate_name = candidate.name or f"Candidate #{candidate_id}"
    candidate_profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_id).first()
    application = db.query(Application).filter(Application.id == application_id).first() if application_id else None
    cover_letter = application.cover_letter if application and application.cover_letter else ""
    if not recruiter.is_online:
        send_notification(
            db,
            user_id=recruiter.id,
            title=f"New application: {candidate_name}",
            body=(
                f"New application received.\n\n"
                f"{_job_summary_block(job)}\n\n"
                f"{_candidate_contact_block(candidate)}\n"
                f"{_candidate_profile_block(candidate_profile)}\n"
                f"Cover letter: {cover_letter or 'N/A'}"
            ),
            idempotency_key=f"candidate_applied:{application_id}:recruiter:{recruiter.id}",
        )


def _process_application_reviewed(db: Session, event: Event) -> None:
    application_id = event.payload.get("application_id")
    candidate_id = event.payload["candidate_id"]
    job_id = event.payload["job_id"]
    new_status = event.payload["new_status"]

    job = db.query(Job).filter(Job.id == job_id).first()
    candidate = db.query(User).filter(User.id == candidate_id).first()
    if not job or not candidate:
        return

    if new_status == "ACCEPTED":
        title = f"Congratulations! Application accepted"
        body = f"Your application for \"{job.title}\" has been accepted."
    else:
        title = f"Application update"
        body = f"Your application for \"{job.title}\" was not selected this time."

    send_notification(
        db,
        user_id=candidate.id,
        title=title,
        body=body,
        idempotency_key=f"application_reviewed:{application_id}:candidate:{candidate.id}",
        bypass_recommendation_policy=True,
    )


def process_next_event(db: Session) -> Event | None:
    event = (
        db.query(Event)
        .filter(Event.status == "PENDING")
        .order_by(asc(Event.created_at))
        .first()
    )
    if not event:
        return None

    try:
        if event.event_type == "job_created":
            _process_job_created(db, event)
        elif event.event_type == "candidate_profile_updated":
            _process_candidate_profile_updated(db, event)
        elif event.event_type == "candidate_applied":
            _process_candidate_applied(db, event)
        elif event.event_type == "application_reviewed":
            _process_application_reviewed(db, event)
        else:
            raise ValueError(f"Unsupported event type: {event.event_type}")
        event.status = "DONE"
        event.updated_at = now_utc()
        event.last_error = ""
    except Exception as exc:  # pylint: disable=broad-except
        event.retry_count += 1
        event.last_error = str(exc)
        event.updated_at = now_utc()
        event.status = "FAILED" if event.retry_count >= MAX_RETRY else "PENDING"
    db.commit()
    db.refresh(event)
    return event


def retry_failed_event(db: Session, event_id: int) -> Event | None:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return None
    if event.status != "FAILED":
        return event
    event.status = "PENDING"
    event.retry_count = 0
    event.last_error = ""
    event.updated_at = now_utc()
    db.commit()
    db.refresh(event)
    return event
