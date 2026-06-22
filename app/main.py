import asyncio
from contextlib import asynccontextmanager, suppress
import os
import uuid
from datetime import timedelta

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, SessionLocal, engine, get_db
from app.models import (
    Application,
    ApplicationMessage,
    AuditLog,
    AuthToken,
    CandidateProfile,
    EmailVerification,
    Event,
    HiddenJob,
    InteractionLog,
    Interview,
    Job,
    Notification,
    RecruiterProfile,
    Recommendation,
    User,
)
from app.schemas import (
    ApplicationCreate,
    ApplicationInvite,
    ApplicationReview,
    CandidateProfileCreate,
    EventOut,
    InteractionCreate,
    InterviewCreate,
    InterviewOut,
    InvitationRespond,
    JobCreate,
    JobUpdate,
    LoginRequest,
    MessageCreate,
    MessageOut,
    RecruiterProfileCreate,
    UserCreate,
    UserOnlineUpdate,
    MockInterviewEvaluate,
)
from app.services.auth import authenticate, get_current_user, issue_token, require_role, require_verified
from app.services.audit import audit
from app.services.cv_parser import parse_cv as regex_parse_cv
from app.services.cv_parser_gemini import parse_cv_with_gemini, GeminiParseResult
from app.services.ai_career_coach import analyze_resume_with_gemini, analyze_skill_gap_with_gemini

from app.services.behavior import reset_no_response_streak, update_all_candidates_behavior, update_user_behavior_state
from app.services.evaluation import compare_baseline_vs_improved, engagement_metrics, precision_recall_at_k
from app.services.events import enqueue_event, process_next_event, retry_failed_event
from app.services.email_tracking import verify_email_click_token
from app.services.email import build_otp_email, is_email_configured
from app.utils.email import send_email
from app.services.rate_limiter import check_rate_limit
from app.services.security import hash_password
from app.services.websockets import manager
from app.utils.time import as_utc, now_utc

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    manager.loop = asyncio.get_running_loop()
    task = asyncio.create_task(background_worker())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Intelligent Job Matching System", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    # Allow local dev origins even when Next.js auto-switches port (e.g. 3001).
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if not os.path.exists("uploads/licenses"):
    os.makedirs("uploads/licenses", exist_ok=True)
if not os.path.exists("uploads/profiles"):
    os.makedirs("uploads/profiles", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


def api_ok(data: dict | list | str | int | float | bool | None, meta: dict | None = None) -> dict:
    payload = {"data": data}
    if meta:
        payload["meta"] = meta
    return payload


def api_error(message: str, code: str, details: dict | None = None) -> dict:
    payload = {"error": {"code": code, "message": message}}
    if details:
        payload["error"]["details"] = details
    return payload


@app.post("/profiles/upload-image")
async def upload_profile_image(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ = db  # keep dependency pattern consistent
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    allowed_ext = {".jpg", ".jpeg", ".png", ".webp"}
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Only jpg, jpeg, png, webp are accepted.")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5 MB).")

    unique_name = f"{current_user.id}_{uuid.uuid4().hex}{ext}"
    relative_path = f"uploads/profiles/{unique_name}"
    with open(relative_path, "wb") as f:
        f.write(data)
    public_path = f"/uploads/profiles/{unique_name}"
    public_url = str(request.base_url).rstrip("/") + public_path
    return api_ok({"path": public_path, "url": public_url})


@app.exception_handler(HTTPException)
async def handle_http_exception(_: Request, exc: HTTPException) -> JSONResponse:
    message = str(exc.detail) if isinstance(exc.detail, str) else "Request failed."
    return JSONResponse(status_code=exc.status_code, content=api_error(message, "http_error"))


@app.exception_handler(RequestValidationError)
async def handle_validation_exception(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=api_error("Validation failed.", "validation_error", details={"issues": exc.errors()}),
    )


@app.exception_handler(Exception)
async def handle_unexpected_exception(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=api_error("Internal server error.", "internal_error", details={"type": type(exc).__name__}),
    )


async def background_worker() -> None:
    while True:
        db = SessionLocal()
        try:
            process_next_event(db)
            update_all_candidates_behavior(db)
        finally:
            db.close()
        await asyncio.sleep(2)


@app.get("/health")
def health() -> dict:
    return api_ok({"status": "ok"})


@app.get("/matching-strategy")
def matching_strategy_info() -> dict:
    return api_ok({
        "strategy": settings.matching_strategy,
        "description": {
            "proficiency": "Proficiency-weighted vectors (level 1-5) with true cosine similarity",
            "tfidf": "TF-IDF weighted sparse vectors (ignores proficiency levels)",
            "embedding": "Dense semantic embeddings via sentence-transformers",
            "gemini": "Google Gemini Embedding API — dense semantic vectors with proficiency context",
            "set": "Binary set-intersection cosine (legacy)",
        }.get(settings.matching_strategy, "unknown"),
        "available": ["proficiency", "tfidf", "embedding", "gemini", "set"],
        "cv_parser": settings.cv_parser_mode,
        "gemini_configured": bool(settings.gemini_api_key),
    })


@app.post("/users")
def create_user(payload: UserCreate, request: Request, db: Session = Depends(get_db)) -> dict:
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(f"register:{client_ip}", limit=20, window_seconds=60)
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists.")
    user = User(
        name=payload.name,
        email=payload.email,
        password=hash_password(payload.password),
        role=payload.role,
        is_online=payload.is_online,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    audit(
        db,
        action="user_created",
        resource_type="user",
        resource_id=str(user.id),
        actor_user_id=user.id,
        detail={"role": user.role},
    )
    return api_ok({"id": user.id, "name": user.name, "role": user.role})


def _generate_otp() -> str:
    import secrets
    return f"{secrets.randbelow(900000) + 100000}"


def _create_and_send_otp(db: Session, user: User) -> bool:
    """Create an OTP record and send the verification email.  Returns True if email was sent."""
    from datetime import timedelta
    otp = _generate_otp()
    verification = EmailVerification(
        user_id=user.id,
        otp=otp,
        created_at=now_utc(),
        expires_at=now_utc() + timedelta(minutes=10),
        used=False,
    )
    db.add(verification)
    db.commit()

    text, html = build_otp_email(otp, user.name)
    return send_email(user.email, "[JobMatch AI] Verify your email", text, html)


@app.post("/auth/register")
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)) -> dict:
    """Public registration — creates user, sends OTP email for verification."""
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(f"register:{client_ip}", limit=10, window_seconds=60)
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    user = User(
        name=payload.name,
        email=payload.email,
        password=hash_password(payload.password),
        role=payload.role,
        is_online=False,
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = issue_token(db, user)

    email_sent = _create_and_send_otp(db, user)

    audit(
        db,
        action="user_registered",
        resource_type="user",
        resource_id=str(user.id),
        actor_user_id=user.id,
        detail={"role": user.role, "ip": client_ip, "otp_email_sent": email_sent},
    )
    return api_ok({
        "token": token,
        "user_id": user.id,
        "name": user.name,
        "role": user.role,
        "email_verified": True,
        "email_sent": email_sent,
    })


@app.post("/auth/verify-email")
def verify_email(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Verify email with OTP code."""
    otp = str(payload.get("otp", "")).strip()
    if not otp or len(otp) != 6:
        raise HTTPException(status_code=400, detail="Please enter a 6-digit verification code.")

    if current_user.email_verified:
        return api_ok({"already_verified": True})

    verification = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.user_id == current_user.id,
            EmailVerification.otp == otp,
            EmailVerification.used == False,
            EmailVerification.expires_at >= now_utc(),
        )
        .order_by(desc(EmailVerification.created_at))
        .first()
    )
    if not verification:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    verification.used = True
    current_user.email_verified = True
    db.commit()

    audit(
        db,
        action="email_verified",
        resource_type="user",
        resource_id=str(current_user.id),
        actor_user_id=current_user.id,
    )
    return api_ok({"verified": True})


@app.post("/auth/resend-otp")
def resend_otp(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Resend OTP verification email."""
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(f"resend_otp:{current_user.id}", limit=3, window_seconds=120)

    if current_user.email_verified:
        return api_ok({"already_verified": True, "email_sent": False})

    email_sent = _create_and_send_otp(db, current_user)
    return api_ok({"email_sent": email_sent})


@app.post("/auth/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(f"login:{client_ip}:{payload.email}", limit=5, window_seconds=60)
    user = authenticate(db, payload.email, payload.password)
    if not user:
        audit(
            db,
            action="login_failed",
            resource_type="auth",
            detail={"email": payload.email, "ip": client_ip},
        )
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = issue_token(db, user)
    audit(
        db,
        action="login_success",
        resource_type="auth",
        actor_user_id=user.id,
        detail={"ip": client_ip},
    )
    return api_ok({"token": token, "user_id": user.id, "name": user.name, "email": user.email, "role": user.role, "email_verified": user.email_verified})


@app.post("/auth/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    # Delete all active tokens for current user to keep endpoint simple.
    db.query(AuthToken).filter(AuthToken.user_id == current_user.id).delete()
    db.commit()
    audit(
        db,
        action="logout",
        resource_type="auth",
        actor_user_id=current_user.id,
        detail={},
    )
    return api_ok({"success": True})


@app.get("/auth/profile")
def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    data: dict = {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "phone": current_user.phone,
        "date_of_birth": current_user.date_of_birth,
    }
    if current_user.role == "recruiter":
        rp = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == current_user.id).first()
        if rp:
            data["company_name"] = rp.company_name
            data["company_website"] = rp.company_website
            data["company_phone"] = rp.company_phone
            data["company_fax"] = rp.company_fax
    return api_ok(data)


@app.put("/auth/profile")
def update_my_profile(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if "name" in payload and payload["name"].strip():
        current_user.name = payload["name"].strip()
    if "phone" in payload:
        current_user.phone = payload["phone"].strip()
    if "date_of_birth" in payload:
        current_user.date_of_birth = payload["date_of_birth"].strip()
    if current_user.role == "recruiter":
        rp = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == current_user.id).first()
        if rp:
            if "company_name" in payload and payload["company_name"].strip():
                rp.company_name = payload["company_name"].strip()
            if "company_website" in payload:
                rp.company_website = payload["company_website"].strip()
            if "company_phone" in payload:
                rp.company_phone = payload["company_phone"].strip()
            if "company_fax" in payload:
                rp.company_fax = payload["company_fax"].strip()
            rp.updated_at = now_utc()
    db.commit()
    audit(db, action="profile_updated", resource_type="user", resource_id=str(current_user.id), actor_user_id=current_user.id, detail={})
    return api_ok({"updated": True})


@app.put("/auth/password")
def change_password(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    old_pw = payload.get("old_password", "")
    new_pw = payload.get("new_password", "")
    if not old_pw or not new_pw:
        raise HTTPException(status_code=400, detail="Both old_password and new_password are required.")
    if len(new_pw) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")
    from app.services.security import verify_password
    if not verify_password(old_pw, current_user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    current_user.password = hash_password(new_pw)
    db.commit()
    audit(db, action="password_changed", resource_type="user", resource_id=str(current_user.id), actor_user_id=current_user.id, detail={})
    return api_ok({"changed": True})


@app.delete("/auth/account")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Permanently delete the current user's account and all associated data."""
    uid = current_user.id
    # Clear recruiter job references first to avoid foreign key violations
    job_ids = [j.id for j in db.query(Job).filter(Job.recruiter_id == uid).all()]
    if job_ids:
        db.query(Application).filter(Application.job_id.in_(job_ids)).delete(synchronize_session=False)
        db.query(Recommendation).filter(Recommendation.job_id.in_(job_ids)).delete(synchronize_session=False)
        db.query(InteractionLog).filter(InteractionLog.job_id.in_(job_ids)).delete(synchronize_session=False)
        db.query(Job).filter(Job.id.in_(job_ids)).delete(synchronize_session=False)

    db.query(AuthToken).filter(AuthToken.user_id == uid).delete()
    db.query(EmailVerification).filter(EmailVerification.user_id == uid).delete()
    db.query(Notification).filter(Notification.user_id == uid).delete()
    db.query(InteractionLog).filter(InteractionLog.user_id == uid).delete()
    db.query(Application).filter(Application.candidate_id == uid).delete()
    db.query(Recommendation).filter(Recommendation.candidate_id == uid).delete()
    db.query(CandidateProfile).filter(CandidateProfile.user_id == uid).delete()
    db.query(RecruiterProfile).filter(RecruiterProfile.user_id == uid).delete()
    db.query(AuditLog).filter(AuditLog.actor_user_id == uid).delete()
    db.query(User).filter(User.id == uid).delete()
    db.commit()
    # Log the delete action using None as actor since the user is deleted
    audit(db, action="account_deleted", resource_type="user", resource_id=str(uid), detail={})
    return api_ok({"deleted": True})


@app.post("/users/{user_id}/online")
def update_online_status(
    user_id: int,
    payload: UserOnlineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="You can only update your own online status.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_online = payload.is_online
    db.commit()
    return api_ok({"user_id": user.id, "is_online": user.is_online})


@app.get("/candidate-profiles/me")
def get_my_candidate_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        return api_ok(None)
    return api_ok({
        "profile_id": profile.id,
        "user_id": profile.user_id,
        "phone": current_user.phone,
        "skills": profile.skills if isinstance(profile.skills, list) else [],
        "experience_level": profile.experience_level,
        "preferred_locations": profile.preferred_locations,
        "preferred_domains": profile.preferred_domains,
        "preferred_work_modes": profile.preferred_work_modes,
        "preferred_employment_types": profile.preferred_employment_types,
        "preferred_salary_min": profile.preferred_salary_min,
        "birth_date": profile.birth_date,
        "avatar_url": profile.avatar_url,
        "cover_url": profile.cover_url,
        "bio": profile.bio,
        "education": profile.education if isinstance(profile.education, list) else [],
        "experiences": profile.experiences if isinstance(profile.experiences, list) else [],
        "status": profile.status,
        "activity_score": profile.activity_score,
    })


@app.post("/candidate-profiles")
def create_or_update_candidate_profile(
    payload: CandidateProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    if current_user.id != payload.user_id:
        raise HTTPException(status_code=403, detail="Candidate can only manage own profile.")
    user = db.query(User).filter(User.id == payload.user_id, User.role == "candidate").first()
    if not user:
        raise HTTPException(status_code=404, detail="Candidate user not found.")

    if payload.phone is not None:
        user.phone = payload.phone

    skills_json = [s.model_dump() for s in payload.skills]
    locations_csv = ",".join(payload.preferred_locations)
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == payload.user_id).first()
    if profile:
        profile.skills = skills_json
        profile.experience_level = payload.experience_level
        profile.preferred_locations = locations_csv
        profile.preferred_domains = payload.preferred_domains
        profile.preferred_work_modes = payload.preferred_work_modes
        profile.preferred_employment_types = payload.preferred_employment_types
        profile.preferred_salary_min = payload.preferred_salary_min
        profile.birth_date = payload.birth_date
        profile.updated_at = now_utc()
    else:
        profile = CandidateProfile(
            user_id=payload.user_id,
            skills=skills_json,
            experience_level=payload.experience_level,
            preferred_locations=locations_csv,
            preferred_domains=payload.preferred_domains,
            preferred_work_modes=payload.preferred_work_modes,
            preferred_employment_types=payload.preferred_employment_types,
            preferred_salary_min=payload.preferred_salary_min,
            birth_date=payload.birth_date,
            last_login_at=now_utc(),
            updated_at=now_utc(),
        )
        db.add(profile)
    db.commit()
    db.refresh(profile)

    event = enqueue_event(
        db,
        event_type="candidate_profile_updated",
        payload={"candidate_id": payload.user_id, "profile_id": profile.id, "timestamp": now_utc().isoformat()},
    )
    return api_ok({"profile_id": profile.id, "event_id": event.id})


@app.post("/candidates/upload-cv")
async def upload_cv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB).")

    parser_error = ""
    if settings.cv_parser_mode == "gemini" or (
        settings.cv_parser_mode == "auto" and settings.gemini_api_key
    ):
        result = parse_cv_with_gemini(contents)
        extraction = result.extraction
        parser_used = result.parser_used
        parser_error = result.gemini_error
    else:
        extraction = regex_parse_cv(contents)
        parser_used = "regex"

    if not extraction.skills:
        return api_ok({
            "parsed": extraction.to_dict(),
            "profile_updated": False,
            "parser": parser_used,
            "error": parser_error,
            "message": "Could not extract skills from the CV.",
        })

    return api_ok({
        "parsed": extraction.to_dict(),
        "profile_updated": False,
        "parser": parser_used,
        "error": parser_error,
        "message": "CV parsed successfully. Please review the extracted information and click Save Profile to confirm.",
    })


@app.post("/recruiter-profiles")
def create_or_update_recruiter_profile(
    payload: RecruiterProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    if current_user.id != payload.user_id:
        raise HTTPException(status_code=403, detail="Recruiter can only manage own profile.")
    user = db.query(User).filter(User.id == payload.user_id, User.role == "recruiter").first()
    if not user:
        raise HTTPException(status_code=404, detail="Recruiter user not found.")
        
    user.phone = payload.phone
    
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == payload.user_id).first()
    if profile:
        profile.company_name = payload.company_name
        profile.updated_at = now_utc()
    else:
        profile = RecruiterProfile(user_id=payload.user_id, company_name=payload.company_name, updated_at=now_utc())
        db.add(profile)
    db.commit()
    db.refresh(profile)
    return api_ok({"profile_id": profile.id})


@app.get("/recruiter-profiles/mine")
def get_my_recruiter_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == current_user.id).first()
    if not profile:
        return api_ok(None)
    return api_ok({
        "id": profile.id,
        "phone": current_user.phone,
        "company_name": profile.company_name,
        "company_website": profile.company_website,
        "company_phone": profile.company_phone,
        "company_fax": profile.company_fax,
        "company_address": profile.company_address,
        "avatar_url": profile.avatar_url,
        "cover_url": profile.cover_url,
        "bio": profile.bio,
        "overview": profile.overview if isinstance(profile.overview, list) else [],
        "tax_id": profile.tax_id,
        "business_license_path": profile.business_license_path,
        "verification_status": profile.verification_status,
        "verification_note": profile.verification_note,
    })


@app.put("/candidate-profiles/me/public")
def update_candidate_public_profile(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found.")
    
    if "phone" in payload:
        current_user.phone = str(payload["phone"]).strip()

    profile.avatar_url = str(payload.get("avatar_url", profile.avatar_url or "")).strip()
    profile.cover_url = str(payload.get("cover_url", profile.cover_url or "")).strip()
    profile.bio = str(payload.get("bio", profile.bio or "")).strip()
    education = payload.get("education", profile.education if isinstance(profile.education, list) else [])
    experiences = payload.get("experiences", profile.experiences if isinstance(profile.experiences, list) else [])
    profile.education = education if isinstance(education, list) else []
    profile.experiences = experiences if isinstance(experiences, list) else []
    profile.updated_at = now_utc()
    db.commit()
    return api_ok({"updated": True})


@app.get("/candidate-profiles/{candidate_id}/public")
def get_candidate_public_profile(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_id).first()
    user = db.query(User).filter(User.id == candidate_id, User.role == "candidate").first()
    if not user or not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found.")
    return api_ok({
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "dob": profile.birth_date,
        "avatar_url": profile.avatar_url,
        "cover_url": profile.cover_url,
        "bio": profile.bio,
        "education": profile.education if isinstance(profile.education, list) else [],
        "experiences": profile.experiences if isinstance(profile.experiences, list) else [],
        "skills": profile.skills if isinstance(profile.skills, list) else [],
        "experience_level": profile.experience_level,
        "preferred_locations": profile.preferred_locations,
        "preferred_salary_min": profile.preferred_salary_min,
    })


@app.put("/recruiter-profiles/mine/public")
def update_recruiter_public_profile(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == current_user.id).first()
    if not profile:
        profile = RecruiterProfile(
            user_id=current_user.id,
            company_name=current_user.name or "My Company",
            company_website="",
            company_phone="",
            company_fax="",
            avatar_url="",
            cover_url="",
            bio="",
            company_address="",
            overview=[],
            tax_id="",
            business_license_path="",
            verification_status="UNVERIFIED",
            verification_note="",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    
    if "phone" in payload:
        current_user.phone = str(payload["phone"]).strip()

    profile.avatar_url = str(payload.get("avatar_url", profile.avatar_url or "")).strip()
    profile.cover_url = str(payload.get("cover_url", profile.cover_url or "")).strip()
    profile.bio = str(payload.get("bio", profile.bio or "")).strip()
    profile.company_address = str(payload.get("company_address", profile.company_address or "")).strip()
    overview = payload.get("overview", profile.overview if isinstance(profile.overview, list) else [])
    profile.overview = overview if isinstance(overview, list) else []
    profile.updated_at = now_utc()
    db.commit()
    return api_ok({"updated": True})


@app.get("/recruiter-profiles/{recruiter_id}/public")
def get_recruiter_public_profile(
    recruiter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == recruiter_id).first()
    user = db.query(User).filter(User.id == recruiter_id, User.role == "recruiter").first()
    if not user or not profile:
        raise HTTPException(status_code=404, detail="Recruiter profile not found.")
    jobs = (
        db.query(Job)
        .filter(Job.recruiter_id == recruiter_id)
        .order_by(desc(Job.created_at))
        .limit(20)
        .all()
    )
    return api_ok({
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "company_name": profile.company_name,
        "company_website": profile.company_website,
        "company_phone": profile.company_phone,
        "company_fax": profile.company_fax,
        "company_address": profile.company_address,
        "avatar_url": profile.avatar_url,
        "cover_url": profile.cover_url,
        "bio": profile.bio,
        "overview": profile.overview if isinstance(profile.overview, list) else [],
        "verification_status": profile.verification_status,
        "jobs": [
            {
                "id": j.id,
                "title": j.title,
                "location": j.location,
                "domain": j.domain,
                "work_mode": j.work_mode,
                "employment_type": j.employment_type,
                "start_date": j.start_date.isoformat() if j.start_date else None,
                "end_date": j.end_date.isoformat() if j.end_date else None,
            }
            for j in jobs
        ],
    })


@app.post("/recruiter-profiles/verify")
def submit_verification(
    company_website: str = "",
    tax_id: str = "",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Create a company profile first.")
    if profile.verification_status == "VERIFIED":
        raise HTTPException(status_code=400, detail="Already verified.")
    if profile.verification_status == "PENDING_REVIEW":
        raise HTTPException(status_code=400, detail="Verification already submitted. Please wait for admin review.")
    ext = os.path.splitext(file.filename or "file")[1] or ".pdf"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = f"uploads/licenses/{filename}"
    with open(filepath, "wb") as f:
        f.write(file.file.read())
    profile.company_website = company_website
    profile.tax_id = tax_id
    profile.business_license_path = filepath
    profile.verification_status = "PENDING_REVIEW"
    profile.verification_note = ""
    profile.updated_at = now_utc()
    db.commit()
    audit(db, action="verification_submitted", resource_type="recruiter_profile", resource_id=str(profile.id), actor_user_id=current_user.id, detail={})
    return api_ok({"status": "PENDING_REVIEW"})


## ─── Admin endpoints ────────────────────────────────────────────────

@app.get("/admin/verifications")
def list_pending_verifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "admin")
    profiles = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.verification_status == "PENDING_REVIEW")
        .order_by(RecruiterProfile.updated_at.desc())
        .all()
    )
    result = []
    for p in profiles:
        user = db.query(User).filter(User.id == p.user_id).first()
        result.append({
            "profile_id": p.id,
            "user_id": p.user_id,
            "recruiter_name": user.name if user else "Unknown",
            "recruiter_email": user.email if user else "",
            "company_name": p.company_name,
            "company_website": p.company_website,
            "tax_id": p.tax_id,
            "business_license_path": p.business_license_path,
            "verification_status": p.verification_status,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        })
    return api_ok(result)


@app.get("/admin/verifications/all")
def list_all_verifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "admin")
    profiles = (
        db.query(RecruiterProfile)
        .filter(RecruiterProfile.verification_status != "UNVERIFIED")
        .order_by(RecruiterProfile.updated_at.desc())
        .all()
    )
    result = []
    for p in profiles:
        user = db.query(User).filter(User.id == p.user_id).first()
        result.append({
            "profile_id": p.id,
            "user_id": p.user_id,
            "recruiter_name": user.name if user else "Unknown",
            "recruiter_email": user.email if user else "",
            "company_name": p.company_name,
            "company_website": p.company_website,
            "tax_id": p.tax_id,
            "business_license_path": p.business_license_path,
            "verification_status": p.verification_status,
            "verification_note": p.verification_note,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        })
    return api_ok(result)


@app.put("/admin/verifications/{profile_id}")
def review_verification(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    action: str = "approve",
    note: str = "",
) -> dict:
    require_role(current_user, "admin")
    profile = db.query(RecruiterProfile).filter(RecruiterProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    if action == "approve":
        profile.verification_status = "VERIFIED"
        profile.verification_note = note or "Approved by admin."
    elif action == "reject":
        profile.verification_status = "REJECTED"
        profile.verification_note = note or "Rejected by admin."
    else:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'.")
    profile.updated_at = now_utc()
    db.commit()
    recruiter = db.query(User).filter(User.id == profile.user_id).first()
    if recruiter:
        from app.services.notifications import send_notification
        status_text = "approved" if action == "approve" else "rejected"
        send_notification(
            db,
            user_id=recruiter.id,
            title=f"Verification {status_text}",
            body=f"Your company verification has been {status_text}. {note}".strip(),
            idempotency_key=f"verification_{action}:{profile.id}:{now_utc().isoformat()}",
        )
    audit(db, action=f"verification_{action}", resource_type="recruiter_profile", resource_id=str(profile_id), actor_user_id=current_user.id, detail={"note": note})
    return api_ok({"profile_id": profile.id, "status": profile.verification_status})


@app.get("/admin/stats")
def admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "admin")
    total_users = db.query(User).count()
    candidates = db.query(User).filter(User.role == "candidate").count()
    recruiters = db.query(User).filter(User.role == "recruiter").count()
    total_jobs = db.query(Job).count()
    total_apps = db.query(Application).count()
    pending_verifications = db.query(RecruiterProfile).filter(RecruiterProfile.verification_status == "PENDING_REVIEW").count()
    verified_recruiters = db.query(RecruiterProfile).filter(RecruiterProfile.verification_status == "VERIFIED").count()
    
    # Calculate evaluation metrics
    quality = precision_recall_at_k(db, k=5)
    engagement = engagement_metrics(db)
    comparison = compare_baseline_vs_improved(db, k=5)
    
    return api_ok({
        "total_users": total_users,
        "candidates": candidates,
        "recruiters": recruiters,
        "total_jobs": total_jobs,
        "total_applications": total_apps,
        "pending_verifications": pending_verifications,
        "verified_recruiters": verified_recruiters,
        "accuracy": {
            "precision_at_5": quality.get("precision_at_k", 0.0),
            "recall_at_5": quality.get("recall_at_k", 0.0),
        },
        "engagement": engagement,
        "model_comparison": comparison,
    })



@app.get("/admin/recruiters")
def list_all_recruiters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Admin endpoint: list all recruiters with job counts and stats."""
    require_role(current_user, "admin")
    recruiters = db.query(User).filter(User.role == "recruiter").order_by(User.created_at.desc()).all()
    result = []
    for r in recruiters:
        profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == r.id).first()
        job_count = db.query(Job).filter(Job.recruiter_id == r.id).count()
        job_ids = [j.id for j in db.query(Job.id).filter(Job.recruiter_id == r.id).all()]
        total_applicants = (
            db.query(Application).filter(Application.job_id.in_(job_ids)).count()
            if job_ids else 0
        )
        result.append({
            "user_id": r.id,
            "name": r.name,
            "email": r.email,
            "phone": r.phone,
            "company_name": profile.company_name if profile else "",
            "company_website": profile.company_website if profile else "",
            "avatar_url": profile.avatar_url if profile else "",
            "verification_status": profile.verification_status if profile else "UNVERIFIED",
            "job_count": job_count,
            "total_applicants": total_applicants,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return api_ok(result)


@app.post("/jobs")
def create_job(payload: JobCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    require_role(current_user, "recruiter")
    # Block unverified recruiters from posting jobs
    rec_profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == current_user.id).first()
    if not rec_profile or rec_profile.verification_status != "VERIFIED":
        raise HTTPException(status_code=403, detail="Only verified recruiters can post jobs. Please complete verification first.")
    if current_user.id != payload.recruiter_id:
        raise HTTPException(status_code=403, detail="Recruiter can only create jobs owned by self.")
    recruiter = db.query(User).filter(User.id == payload.recruiter_id, User.role == "recruiter").first()
    if not recruiter:
        raise HTTPException(status_code=404, detail="Recruiter not found.")
    job = Job(
        recruiter_id=payload.recruiter_id,
        title=payload.title,
        brief_description=payload.brief_description,
        required_skills=[s.model_dump() for s in payload.required_skills],
        location=payload.location,
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        experience_level=payload.experience_level,
        domain=payload.domain,
        work_mode=payload.work_mode,
        employment_type=payload.employment_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        external_link=payload.external_link,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    should_match_now = True
    if payload.start_date and as_utc(payload.start_date) > now_utc():
        should_match_now = False
    event = None
    if should_match_now:
        event = enqueue_event(
            db,
            event_type="job_created",
            payload={"job_id": job.id, "recruiter_id": payload.recruiter_id, "timestamp": now_utc().isoformat()},
        )
    audit(
        db,
        action="job_created",
        resource_type="job",
        resource_id=str(job.id),
        actor_user_id=current_user.id,
        detail={"event_id": event.id if event else None},
    )
    return api_ok({"job_id": job.id, "event_id": event.id if event else None, "scheduled": not should_match_now})


@app.get("/jobs/mine")
def list_my_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return all jobs created by the current recruiter, newest first."""
    require_role(current_user, "recruiter")
    jobs = (
        db.query(Job)
        .filter(Job.recruiter_id == current_user.id)
        .order_by(Job.created_at.desc())
        .all()
    )
    now = now_utc()
    result = []
    for j in jobs:
        rec_count = db.query(Recommendation).filter(Recommendation.job_id == j.id).count()
        status = "active"
        if j.start_date and as_utc(j.start_date) > now:
            status = "scheduled"
        elif j.end_date and as_utc(j.end_date) < now:
            status = "expired"
        result.append({
            "id": j.id,
            "recruiter_id": j.recruiter_id,
            "title": j.title,
            "brief_description": j.brief_description,
            "required_skills": j.required_skills or [],
            "location": j.location,
            "salary_min": j.salary_min,
            "salary_max": j.salary_max,
            "experience_level": j.experience_level,
            "domain": j.domain,
            "work_mode": j.work_mode,
            "employment_type": j.employment_type,
            "start_date": j.start_date.isoformat() if j.start_date else None,
            "end_date": j.end_date.isoformat() if j.end_date else None,
            "external_link": j.external_link,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "match_count": rec_count,
            "status": status,
        })
    return api_ok(result)


@app.get("/jobs/saved")
def list_saved_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return jobs the current candidate has saved (click interaction), newest first."""
    require_role(current_user, "candidate")
    # Exclude jobs already applied to
    applied_job_ids = [
        row[0] for row in db.query(Application.job_id)
        .filter(Application.candidate_id == current_user.id)
        .all()
    ]

    query = db.query(InteractionLog.job_id).filter(
        InteractionLog.user_id == current_user.id,
        InteractionLog.event_type == "click",
        InteractionLog.job_id.isnot(None),
    )
    if applied_job_ids:
        query = query.filter(InteractionLog.job_id.notin_(applied_job_ids))
        
    saved_logs = query.distinct().all()
    saved_ids = [row[0] for row in saved_logs]
    if not saved_ids:
        return api_ok([])
    jobs = db.query(Job).filter(Job.id.in_(saved_ids)).all()
    result = []
    for j in jobs:
        company = _get_company_name(db, j.recruiter_id)
        rec = (
            db.query(Recommendation)
            .filter(Recommendation.job_id == j.id, Recommendation.candidate_id == current_user.id)
            .order_by(Recommendation.created_at.desc())
            .first()
        )
        result.append({
            "id": j.id,
            "title": j.title,
            "brief_description": j.brief_description,
            "required_skills": j.required_skills or [],
            "location": j.location,
            "salary_min": j.salary_min,
            "salary_max": j.salary_max,
            "experience_level": j.experience_level,
            "domain": j.domain,
            "work_mode": j.work_mode,
            "employment_type": j.employment_type,
            "company": company,
            **_get_company_contact(db, j.recruiter_id),
            "recruiter_verified": _get_recruiter_verified(db, j.recruiter_id),
            "start_date": j.start_date.isoformat() if j.start_date else None,
            "end_date": j.end_date.isoformat() if j.end_date else None,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "score": rec.final_score if rec else None,
            "skill_match": rec.skill_match if rec else None,
        })
    return api_ok(result)


@app.get("/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    recruiter = db.query(User).filter(User.id == job.recruiter_id).first()
    company = _get_company_name(db, job.recruiter_id)
    rec_count = db.query(Recommendation).filter(Recommendation.job_id == job.id).count()
    return api_ok({
        "id": job.id,
        "recruiter_id": job.recruiter_id,
        "title": job.title,
        "brief_description": job.brief_description,
        "required_skills": job.required_skills or [],
        "location": job.location,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "experience_level": job.experience_level,
        "domain": job.domain,
        "work_mode": job.work_mode,
        "employment_type": job.employment_type,
        "start_date": job.start_date.isoformat() if job.start_date else None,
        "end_date": job.end_date.isoformat() if job.end_date else None,
        "external_link": job.external_link,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "recruiter_name": recruiter.name if recruiter else "Unknown",
        "company": company,
        **_get_company_contact(db, job.recruiter_id),
        "recruiter_verified": _get_recruiter_verified(db, job.recruiter_id),
        "match_count": rec_count,
    })


@app.put("/jobs/{job_id}")
def update_job(
    job_id: int,
    payload: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    # Block unverified recruiters from editing jobs
    rec_profile = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == current_user.id).first()
    if not rec_profile or rec_profile.verification_status != "VERIFIED":
        raise HTTPException(status_code=403, detail="Only verified recruiters can edit jobs. Please complete verification first.")
    job = db.query(Job).filter(Job.id == job_id, Job.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not owned by you.")
    job.title = payload.title
    job.brief_description = payload.brief_description
    job.required_skills = [s.model_dump() for s in payload.required_skills]
    job.location = payload.location
    job.salary_min = payload.salary_min
    job.salary_max = payload.salary_max
    job.experience_level = payload.experience_level
    job.domain = payload.domain
    job.work_mode = payload.work_mode
    job.employment_type = payload.employment_type
    job.start_date = payload.start_date
    job.end_date = payload.end_date
    job.external_link = payload.external_link
    db.query(Recommendation).filter(Recommendation.job_id == job.id).delete()
    db.commit()
    db.refresh(job)
    should_match = True
    if payload.start_date and as_utc(payload.start_date) > now_utc():
        should_match = False
    event = None
    if should_match:
        event = enqueue_event(
            db,
            event_type="job_created",
            payload={"job_id": job.id, "recruiter_id": current_user.id, "timestamp": now_utc().isoformat()},
        )
    audit(db, action="job_updated", resource_type="job", resource_id=str(job.id), actor_user_id=current_user.id, detail={"event_id": event.id if event else None})
    return api_ok({"job_id": job.id, "event_id": event.id if event else None, "rematched": should_match})


@app.delete("/jobs/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    job = db.query(Job).filter(Job.id == job_id, Job.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not owned by you.")
    db.query(Application).filter(Application.job_id == job_id).delete()
    db.query(Recommendation).filter(Recommendation.job_id == job_id).delete()
    db.query(InteractionLog).filter(InteractionLog.job_id == job_id).delete()
    db.query(Job).filter(Job.id == job_id).delete()
    db.commit()
    audit(db, action="job_deleted", resource_type="job", resource_id=str(job_id), actor_user_id=current_user.id, detail={})
    return api_ok({"deleted": True})


## ─── Applications ───────────────────────────────────────────────────

@app.post("/applications")
def create_application(
    payload: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    job = db.query(Job).filter(Job.id == payload.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    existing = (
        db.query(Application)
        .filter(Application.candidate_id == current_user.id, Application.job_id == payload.job_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You have already applied for this job.")
    application = Application(
        candidate_id=current_user.id,
        job_id=payload.job_id,
        cover_letter=payload.cover_letter,
        status="PENDING",
    )
    db.add(application)
    db.add(InteractionLog(
        user_id=current_user.id,
        job_id=payload.job_id,
        event_type="apply",
        event_metadata={},
    ))
    db.commit()
    db.refresh(application)
    enqueue_event(
        db,
        event_type="candidate_applied",
        payload={
            "application_id": application.id,
            "candidate_id": current_user.id,
            "job_id": payload.job_id,
            "recruiter_id": job.recruiter_id,
            "timestamp": now_utc().isoformat(),
        },
    )
    audit(db, action="application_created", resource_type="application", resource_id=str(application.id), actor_user_id=current_user.id, detail={"job_id": payload.job_id})
    return api_ok({"application_id": application.id, "status": application.status})


@app.get("/applications/mine")
def list_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    apps = (
        db.query(Application)
        .filter(Application.candidate_id == current_user.id)
        .order_by(Application.created_at.desc())
        .all()
    )
    app_ids = [a.id for a in apps]
    unread_counts = dict(
        db.query(ApplicationMessage.application_id, func.count(ApplicationMessage.id))
        .filter(
            ApplicationMessage.application_id.in_(app_ids),
            ApplicationMessage.sender_id != current_user.id,
            ApplicationMessage.is_read == False
        )
        .group_by(ApplicationMessage.application_id)
        .all()
    ) if app_ids else {}

    result = []
    for a in apps:
        job = db.query(Job).filter(Job.id == a.job_id).first()
        company = _get_company_name(db, job.recruiter_id) if job else "Unknown"
        rec = (
            db.query(Recommendation)
            .filter(Recommendation.job_id == a.job_id, Recommendation.candidate_id == current_user.id)
            .order_by(Recommendation.created_at.desc())
            .first()
        )
        result.append({
            "id": a.id,
            "job_id": a.job_id,
            "job_title": job.title if job else "Deleted",
            "company": company,
            **(_get_company_contact(db, job.recruiter_id) if job else {"company_phone": "", "company_website": "", "company_avatar_url": ""}),
            "location": job.location if job else "",
            "cover_letter": a.cover_letter,
            "status": a.status,
            "score": rec.final_score if rec else None,
            "unread_messages_count": unread_counts.get(a.id, 0),
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        })
    return api_ok(result)


@app.delete("/applications/{application_id}")
def withdraw_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    app_obj = (
        db.query(Application)
        .filter(Application.id == application_id, Application.candidate_id == current_user.id)
        .first()
    )
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found.")
    if app_obj.status != "PENDING":
        raise HTTPException(status_code=400, detail="Can only withdraw pending applications.")
    app_obj.status = "WITHDRAWN"
    app_obj.updated_at = now_utc()
    db.commit()
    audit(db, action="application_withdrawn", resource_type="application", resource_id=str(application_id), actor_user_id=current_user.id, detail={})
    return api_ok({"withdrawn": True})


@app.get("/applications/all")
def list_all_applications_for_recruiter(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    my_jobs = db.query(Job).filter(Job.recruiter_id == current_user.id).all()
    job_map = {j.id: j for j in my_jobs}
    if not job_map:
        return api_ok([])
    apps = (
        db.query(Application)
        .filter(Application.job_id.in_(job_map.keys()))
        .order_by(Application.created_at.desc())
        .all()
    )
    app_ids = [a.id for a in apps]
    unread_counts = dict(
        db.query(ApplicationMessage.application_id, func.count(ApplicationMessage.id))
        .filter(
            ApplicationMessage.application_id.in_(app_ids),
            ApplicationMessage.sender_id != current_user.id,
            ApplicationMessage.is_read == False
        )
        .group_by(ApplicationMessage.application_id)
        .all()
    ) if app_ids else {}

    result = []
    for a in apps:
        job = job_map.get(a.job_id)
        candidate = db.query(User).filter(User.id == a.candidate_id).first()
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == a.candidate_id).first()
        rec = (
            db.query(Recommendation)
            .filter(Recommendation.job_id == a.job_id, Recommendation.candidate_id == a.candidate_id)
            .order_by(Recommendation.created_at.desc())
            .first()
        )
        result.append({
            "id": a.id,
            "job_id": a.job_id,
            "job_title": job.title if job else "Deleted",
            "candidate_id": a.candidate_id,
            "candidate_name": candidate.name if candidate else "Unknown",
            "candidate_email": candidate.email if candidate else "",
            "candidate_phone": candidate.phone if candidate else "",
            "candidate_dob": candidate.date_of_birth if candidate else "",
            "skills": profile.skills if profile else [],
            "experience_level": profile.experience_level if profile else "",
            "domain": profile.preferred_domains if profile else "",
            "work_mode": profile.preferred_work_modes if profile else "",
            "employment_type": profile.preferred_employment_types if profile else "",
            "cover_letter": a.cover_letter,
            "status": a.status,
            "score": rec.final_score if rec else None,
            "unread_messages_count": unread_counts.get(a.id, 0),
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return api_ok(result)


@app.get("/applications/job/{job_id}")
def list_applicants_for_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    job = db.query(Job).filter(Job.id == job_id, Job.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not owned by you.")
    apps = (
        db.query(Application)
        .filter(Application.job_id == job_id)
        .order_by(Application.created_at.desc())
        .all()
    )
    app_ids = [a.id for a in apps]
    unread_counts = dict(
        db.query(ApplicationMessage.application_id, func.count(ApplicationMessage.id))
        .filter(
            ApplicationMessage.application_id.in_(app_ids),
            ApplicationMessage.sender_id != current_user.id,
            ApplicationMessage.is_read == False
        )
        .group_by(ApplicationMessage.application_id)
        .all()
    ) if app_ids else {}

    result = []
    for a in apps:
        candidate = db.query(User).filter(User.id == a.candidate_id).first()
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == a.candidate_id).first()
        rec = (
            db.query(Recommendation)
            .filter(Recommendation.job_id == job_id, Recommendation.candidate_id == a.candidate_id)
            .order_by(Recommendation.created_at.desc())
            .first()
        )
        result.append({
            "id": a.id,
            "candidate_id": a.candidate_id,
            "candidate_name": candidate.name if candidate else "Unknown",
            "candidate_email": candidate.email if candidate else "",
            "candidate_phone": candidate.phone if candidate else "",
            "candidate_dob": candidate.date_of_birth if candidate else "",
            "skills": profile.skills if profile else [],
            "experience_level": profile.experience_level if profile else "",
            "domain": profile.preferred_domains if profile else "",
            "work_mode": profile.preferred_work_modes if profile else "",
            "employment_type": profile.preferred_employment_types if profile else "",
            "cover_letter": a.cover_letter,
            "status": a.status,
            "score": rec.final_score if rec else None,
            "unread_messages_count": unread_counts.get(a.id, 0),
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return api_ok(result)


@app.put("/applications/{application_id}/review")
def review_application(
    application_id: int,
    payload: ApplicationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    app_obj = db.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found.")
    job = db.query(Job).filter(Job.id == app_obj.job_id, Job.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=403, detail="Not your job posting.")
    if app_obj.status not in ("PENDING", "REVIEWED", "INTERVIEWING"):
        raise HTTPException(status_code=400, detail=f"Cannot review application with status '{app_obj.status}'.")
    app_obj.status = payload.status
    app_obj.updated_at = now_utc()
    if payload.status == "HIRED":
        db.add(InteractionLog(
            user_id=app_obj.candidate_id,
            job_id=app_obj.job_id,
            event_type="hired",
            event_metadata={"weight": 100.0},
        ))
    db.commit()
    db.refresh(app_obj)
    
    candidate_user = db.query(User).filter(User.id == app_obj.candidate_id).first()
    if candidate_user and candidate_user.email:
        subject = None
        if payload.status == "HIRED":
            subject = f"[JobMatch AI] Congratulations! You have been hired for {job.title}"
            text_content = f"Hi {candidate_user.name},\n\nWe are thrilled to inform you that {current_user.name} has selected you for the position of {job.title}.\nPlease log in to your dashboard to review the offer and next steps.\n\nBest,\nJobMatch AI Team"
            html_content = f"<p>Hi <b>{candidate_user.name}</b>,</p><p>We are thrilled to inform you that <b>{current_user.name}</b> has selected you for the position of <b>{job.title}</b>.</p><p>Please log in to your dashboard to review the offer and next steps.</p><p>Best,<br>JobMatch AI Team</p>"
        elif payload.status == "REJECTED":
            subject = f"[JobMatch AI] Update on your application for {job.title}"
            text_content = f"Hi {candidate_user.name},\n\nThank you for applying to the {job.title} position.\nUnfortunately, the recruiter has decided not to move forward with your application at this time.\nWe encourage you to keep exploring other opportunities on our platform.\n\nBest,\nJobMatch AI Team"
            html_content = f"<p>Hi <b>{candidate_user.name}</b>,</p><p>Thank you for applying to the <b>{job.title}</b> position.</p><p>Unfortunately, the recruiter has decided not to move forward with your application at this time.</p><p>We encourage you to keep exploring other opportunities on our platform.</p><p>Best,<br>JobMatch AI Team</p>"
            
        if subject:
            from app.utils.email import send_email
            send_email(candidate_user.email, subject, text_content, html_content)
            db.add(Notification(
                user_id=candidate_user.id,
                title="Application Update",
                body=f"Your application for {job.title} is now: {payload.status}.",
            ))
            db.commit()
    enqueue_event(
        db,
        event_type="application_reviewed",
        payload={
            "application_id": app_obj.id,
            "candidate_id": app_obj.candidate_id,
            "job_id": app_obj.job_id,
            "new_status": payload.status,
            "recruiter_id": current_user.id,
            "timestamp": now_utc().isoformat(),
        },
    )
    audit(db, action="application_reviewed", resource_type="application", resource_id=str(application_id), actor_user_id=current_user.id, detail={"new_status": payload.status})
    return api_ok({"application_id": app_obj.id, "status": app_obj.status})


@app.get("/recommendations/discover")
def discover_candidates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    jobs = db.query(Job).filter(Job.recruiter_id == current_user.id).all()
    if not jobs:
        return api_ok([])
    job_ids = [j.id for j in jobs]
    
    recommendations = db.query(Recommendation).filter(
        Recommendation.job_id.in_(job_ids),
        Recommendation.final_score >= 0.70
    ).all()
    
    result = []
    for rec in recommendations:
        existing_app = db.query(Application).filter(
            Application.job_id == rec.job_id,
            Application.candidate_id == rec.candidate_id
        ).first()
        if existing_app:
            continue
            
        candidate_user = db.query(User).filter(User.id == rec.candidate_id).first()
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == rec.candidate_id).first()
        job = next((j for j in jobs if j.id == rec.job_id), None)
        
        if candidate_user and profile and job:
            result.append({
                "job_id": job.id,
                "job_title": job.title,
                "candidate_id": candidate_user.id,
                "candidate_name": candidate_user.name,
                "skills": profile.skills if isinstance(profile.skills, list) else [],
                "experience_level": profile.experience_level,
                "domain": profile.preferred_domains,
                "work_mode": profile.preferred_work_modes,
                "score": rec.final_score,
            })
    
    result.sort(key=lambda x: x["score"], reverse=True)
    return api_ok(result)


@app.post("/applications/invite")
def invite_candidate(
    payload: ApplicationInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    job = db.query(Job).filter(Job.id == payload.job_id, Job.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=403, detail="Not your job posting.")
        
    existing_app = db.query(Application).filter(
        Application.job_id == payload.job_id,
        Application.candidate_id == payload.candidate_id
    ).first()
    if existing_app:
        raise HTTPException(status_code=400, detail="Candidate already applied or was invited.")
        
    app_obj = Application(
        candidate_id=payload.candidate_id,
        job_id=payload.job_id,
        status="INVITED"
    )
    db.add(app_obj)
    db.commit()
    db.refresh(app_obj)
    
    db.add(Notification(
        user_id=payload.candidate_id,
        title=f"New Job Invitation: {job.title}",
        body=f"You have been invited to apply for the position by {current_user.name}.",
    ))
    db.commit()
    
    candidate_user = db.query(User).filter(User.id == payload.candidate_id).first()
    if candidate_user and candidate_user.email:
        subject = f"[JobMatch AI] Invitation to apply for {job.title}"
        text_content = f"Hi {candidate_user.name},\n\nYou have been invited by {current_user.name} to apply for the position of {job.title}.\nPlease log in to JobMatch AI to review the invitation and accept or decline.\n\nBest,\nJobMatch AI Team"
        html_content = f"<p>Hi <b>{candidate_user.name}</b>,</p><p>You have been invited by <b>{current_user.name}</b> to apply for the position of <b>{job.title}</b>.</p><p>Please log in to JobMatch AI to review the invitation and accept or decline.</p><p>Best,<br>JobMatch AI Team</p>"
        from app.utils.email import send_email
        send_email(candidate_user.email, subject, text_content, html_content)
    return api_ok({"application_id": app_obj.id, "status": app_obj.status})


@app.post("/applications/{application_id}/respond")
def respond_to_invitation(
    application_id: int,
    payload: InvitationRespond,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    app_obj = db.query(Application).filter(Application.id == application_id, Application.candidate_id == current_user.id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found.")
    if app_obj.status != "INVITED":
        raise HTTPException(status_code=400, detail="Application is not an invitation.")
        
    job = db.query(Job).filter(Job.id == app_obj.job_id).first()
    
    if payload.action == "ACCEPT":
        app_obj.status = "PENDING"
        if job:
            db.add(Notification(
                user_id=job.recruiter_id,
                title="Invitation Accepted",
                body=f"Candidate {current_user.name} has accepted your invitation for {job.title}.",
            ))
    else:
        app_obj.status = "WITHDRAWN"
        if job:
            db.add(Notification(
                user_id=job.recruiter_id,
                title="Invitation Declined",
                body=f"Candidate {current_user.name} has declined your invitation for {job.title}.",
            ))
            
    app_obj.updated_at = now_utc()
    db.commit()
    db.refresh(app_obj)
    return api_ok({"application_id": app_obj.id, "status": app_obj.status})


from app.services.mock_interview import generate_mock_questions, evaluate_mock_answer

@app.post("/applications/{application_id}/mock-interview/generate")
def api_mock_interview_generate(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    app_obj = db.query(Application).filter(Application.id == application_id, Application.candidate_id == current_user.id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found.")
    
    if app_obj.status not in ["ACCEPTED", "INTERVIEWING"]:
        raise HTTPException(status_code=400, detail="Mock interviews are only available for accepted or interviewing applications.")
        
    job = db.query(Job).filter(Job.id == app_obj.job_id).first()
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    
    if not job or not profile:
        raise HTTPException(status_code=404, detail="Job or Candidate Profile not found.")
        
    job_desc = job.brief_description or ""
    candidate_skills = ", ".join(
        skill.get("name", "") if isinstance(skill, dict) else str(skill)
        for skill in (profile.skills or [])
    )
    
    questions = generate_mock_questions(job.title, job_desc, candidate_skills)
    return api_ok({"questions": questions})

@app.post("/applications/{application_id}/mock-interview/evaluate")
def api_mock_interview_evaluate(
    application_id: str,
    payload: MockInterviewEvaluate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    # Verify application belongs to candidate
    app_obj = db.query(Application).filter(Application.id == application_id, Application.candidate_id == current_user.id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found.")
        
    result = evaluate_mock_answer(payload.question, payload.answer)
    return api_ok(result)


@app.post("/candidate-profiles/me/analyze-resume")
def api_analyze_resume(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.role != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates can analyze their resumes.")
    
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    
    profile_data = {
        "bio": profile.bio,
        "experience_level": profile.experience_level,
        "education": profile.education,
        "experiences": profile.experiences,
        "skills": profile.skills,
    }
    
    analysis = analyze_resume_with_gemini(profile_data)
    return api_ok(analysis)


@app.post("/jobs/{job_id}/analyze-gap")
def api_analyze_skill_gap(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.role != "candidate":
        raise HTTPException(status_code=403, detail="Only candidates can analyze skill gaps.")
    
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Candidate profile not found.")
        
    candidate_skills = ", ".join(
        skill.get("name", "") if isinstance(skill, dict) else str(skill)
        for skill in (profile.skills or [])
    )
    job_skills = ", ".join(
        skill.get("name", "") if isinstance(skill, dict) else str(skill)
        for skill in (job.required_skills or [])
    )
    job_desc = job.brief_description or ""
    
    analysis = analyze_skill_gap_with_gemini(candidate_skills, job_skills, job_desc)
    return api_ok(analysis)


@app.post("/interviews", response_model=dict)
def create_interview(
    payload: InterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    app_obj = db.query(Application).filter(Application.id == payload.application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found.")
    job = db.query(Job).filter(Job.id == app_obj.job_id, Job.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=403, detail="Not your job posting.")
        
    interview = Interview(
        application_id=payload.application_id,
        recruiter_id=current_user.id,
        candidate_id=app_obj.candidate_id,
        scheduled_time=payload.scheduled_time,
        location_type=payload.location_type,
        location_details=payload.location_details,
        notes=payload.notes,
        status="SCHEDULED"
    )
    db.add(interview)
    
    app_obj.status = "INTERVIEWING"
    db.commit()
    db.refresh(interview)
    
    candidate = db.query(User).filter(User.id == app_obj.candidate_id).first()
    if candidate:
        send_email(
            to_email=candidate.email,
            subject=f"Lịch phỏng vấn mới: {job.title}",
            body=f"Chào {candidate.name},\n\nBạn có lịch phỏng vấn mới cho vị trí {job.title}.\nThời gian: {payload.scheduled_time.strftime('%Y-%m-%d %H:%M')}\nHình thức: {payload.location_type}\nChi tiết: {payload.location_details}\n\nVui lòng kiểm tra trên hệ thống để biết thêm chi tiết."
        )
        
    return api_ok({"interview_id": interview.id})


@app.get("/interviews/recruiter", response_model=dict)
def get_recruiter_interviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    interviews = db.query(Interview).filter(Interview.recruiter_id == current_user.id).order_by(Interview.scheduled_time.asc()).all()
    out = [InterviewOut.model_validate(i).model_dump() for i in interviews]
    return api_ok(out)


@app.get("/interviews/candidate", response_model=dict)
def get_candidate_interviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    interviews = db.query(Interview).filter(Interview.candidate_id == current_user.id).order_by(Interview.scheduled_time.asc()).all()
    
    out = []
    for i in interviews:
        data = InterviewOut.model_validate(i).model_dump()
        app_obj = db.query(Application).filter(Application.id == i.application_id).first()
        if app_obj:
            job = db.query(Job).filter(Job.id == app_obj.job_id).first()
            if job:
                data["job_title"] = job.title
                company = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == job.recruiter_id).first()
                if company:
                    data["company_name"] = company.company_name
        out.append(data)
        
    return api_ok(out)


@app.get("/applications/{application_id}/messages", response_model=dict)
def get_messages(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    app_obj = db.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found.")
    
    # Permission check
    if current_user.role == "candidate":
        if app_obj.candidate_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your application.")
    elif current_user.role == "recruiter":
        job = db.query(Job).filter(Job.id == app_obj.job_id, Job.recruiter_id == current_user.id).first()
        if not job:
            raise HTTPException(status_code=403, detail="Not your job posting.")
            
    messages = db.query(ApplicationMessage).filter(ApplicationMessage.application_id == application_id).order_by(ApplicationMessage.created_at.asc()).all()
    out = [MessageOut.model_validate(m).model_dump() for m in messages]
    return api_ok(out)


@app.get("/messages/unread-count", response_model=dict)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.role == "candidate":
        app_ids = [a.id for a in db.query(Application.id).filter(Application.candidate_id == current_user.id).all()]
    elif current_user.role == "recruiter":
        job_ids = [j.id for j in db.query(Job.id).filter(Job.recruiter_id == current_user.id).all()]
        app_ids = [a.id for a in db.query(Application.id).filter(Application.job_id.in_(job_ids)).all()]
    else:
        app_ids = []
    
    if not app_ids:
        return api_ok({"unread_count": 0})
        
    count = db.query(ApplicationMessage).filter(
        ApplicationMessage.application_id.in_(app_ids),
        ApplicationMessage.sender_id != current_user.id,
        ApplicationMessage.is_read == False
    ).count()
    return api_ok({"unread_count": count})


@app.post("/applications/{application_id}/messages/read", response_model=dict)
def mark_messages_read(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    app_obj = db.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found.")
        
    if current_user.role == "candidate" and app_obj.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your application.")
    elif current_user.role == "recruiter":
        job = db.query(Job).filter(Job.id == app_obj.job_id, Job.recruiter_id == current_user.id).first()
        if not job:
            raise HTTPException(status_code=403, detail="Not your job posting.")
            
    db.query(ApplicationMessage).filter(
        ApplicationMessage.application_id == application_id,
        ApplicationMessage.sender_id != current_user.id,
        ApplicationMessage.is_read == False
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    
    return api_ok({"marked_read": True})

from fastapi import BackgroundTasks

@app.post("/applications/{application_id}/messages", response_model=dict)
def create_message(
    application_id: int,
    payload: MessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    app_obj = db.query(Application).filter(Application.id == application_id).first()
    if not app_obj:
        raise HTTPException(status_code=404, detail="Application not found.")
        
    if app_obj.status not in ["ACCEPTED", "INTERVIEWING"]:
        raise HTTPException(status_code=400, detail="Messaging only allowed for accepted/interviewing applications.")
    
    # Permission check
    if current_user.role == "candidate":
        if app_obj.candidate_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your application.")
    elif current_user.role == "recruiter":
        job = db.query(Job).filter(Job.id == app_obj.job_id, Job.recruiter_id == current_user.id).first()
        if not job:
            raise HTTPException(status_code=403, detail="Not your job posting.")
            
    msg = ApplicationMessage(
        application_id=application_id,
        sender_id=current_user.id,
        content=payload.content
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    
    # Send WebSocket message
    recipient_id = app_obj.candidate_id
    if current_user.role == "candidate":
        job = db.query(Job).filter(Job.id == app_obj.job_id).first()
        if job:
            recipient_id = job.recruiter_id
            
    if recipient_id:
        manager.dispatch(
            {
                "type": "new_message",
                "application_id": application_id,
                "message": {
                    "id": msg.id,
                    "application_id": msg.application_id,
                    "sender_id": msg.sender_id,
                    "content": msg.content,
                    "is_read": msg.is_read,
                    "created_at": msg.created_at.isoformat()
                }
            },
            recipient_id
        )
    
    return api_ok(MessageOut.model_validate(msg).model_dump())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    token_row = db.query(AuthToken).filter(AuthToken.token == token).first()
    if not token_row or as_utc(token_row.expires_at) < now_utc():
        await websocket.close(code=1008)
        return
        
    user_id = token_row.user_id
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming ping/pong if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)



@app.post("/interactions")
def create_interaction(
    payload: InteractionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.id != payload.user_id:
        raise HTTPException(status_code=403, detail="You can only create your own interactions.")
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    interaction = InteractionLog(
        user_id=payload.user_id,
        job_id=payload.job_id,
        event_type=payload.event_type,
        event_metadata=payload.event_metadata,
        created_at=now_utc(),
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)
    if payload.event_type in {"click", "apply", "login"} and user.role == "candidate":
        reset_no_response_streak(db, user.id)
        if payload.event_type == "login":
            profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == user.id).first()
            if profile:
                profile.last_login_at = interaction.created_at
                db.commit()
        update_user_behavior_state(db, user.id)
    return api_ok({"interaction_id": interaction.id})


@app.get("/events")
def list_events(
    status: str | None = None,
    offset: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    query = db.query(Event)
    if status:
        query = query.filter(Event.status == status)
    events = query.order_by(desc(Event.created_at)).offset(max(offset, 0)).limit(min(max(limit, 1), 200)).all()
    rows = [EventOut.model_validate(event).model_dump(mode="json") for event in events]
    return api_ok(rows, meta={"offset": max(offset, 0), "limit": min(max(limit, 1), 200), "count": len(rows)})


@app.get("/events/failed")
def list_failed_events(
    offset: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    events = (
        db.query(Event)
        .filter(Event.status == "FAILED")
        .order_by(desc(Event.created_at))
        .offset(max(offset, 0))
        .limit(min(max(limit, 1), 200))
        .all()
    )
    rows = [EventOut.model_validate(event).model_dump(mode="json") for event in events]
    return api_ok(rows, meta={"offset": max(offset, 0), "limit": min(max(limit, 1), 200), "count": len(rows)})


@app.post("/events/{event_id}/retry")
def retry_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    require_role(current_user, "recruiter")
    event = retry_failed_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    audit(
        db,
        action="event_retried",
        resource_type="event",
        resource_id=str(event.id),
        actor_user_id=current_user.id,
        detail={"status": event.status},
    )
    return api_ok({"event_id": event.id, "status": event.status})


@app.post("/events/process")
def process_events_now(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    processed = 0
    for _ in range(max(1, min(limit, 100))):
        event = process_next_event(db)
        if not event:
            break
        processed += 1
    audit(
        db,
        action="events_processed_manually",
        resource_type="event",
        actor_user_id=current_user.id,
        detail={"processed": processed, "limit": limit},
    )
    return api_ok({"processed": processed})


@app.get("/audit-logs")
def list_audit_logs(
    action: str | None = None,
    offset: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    rows = (
        query.order_by(desc(AuditLog.created_at))
        .offset(max(offset, 0))
        .limit(min(max(limit, 1), 200))
        .all()
    )
    data = [
        {
            "id": row.id,
            "actor_user_id": row.actor_user_id,
            "action": row.action,
            "resource_type": row.resource_type,
            "resource_id": row.resource_id,
            "detail": row.detail,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]
    return api_ok(data, meta={"offset": max(offset, 0), "limit": min(max(limit, 1), 200), "count": len(data)})


def _get_company_name(db: Session, recruiter_id: int) -> str:
    rp = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == recruiter_id).first()
    return rp.company_name if rp else ""


def _get_company_contact(db: Session, recruiter_id: int) -> dict:
    rp = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == recruiter_id).first()
    return {
        "company_phone": rp.company_phone if rp else "",
        "company_website": rp.company_website if rp else "",
        "company_avatar_url": rp.avatar_url if rp else "",
    }


def _get_recruiter_verified(db: Session, recruiter_id: int) -> bool:
    rp = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == recruiter_id).first()
    return rp.verification_status == "VERIFIED" if rp else False


@app.get("/dashboard/recruiter/{recruiter_id}")
def recruiter_dashboard(
    recruiter_id: int,
    job_id: int | None = None,
    top_k: int = 20,
    min_score: float | None = None,
    filter_status: str = "unapplied",
    offset: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "recruiter")
    if current_user.id != recruiter_id:
        raise HTTPException(status_code=403, detail="Forbidden recruiter dashboard.")
    jobs_query = db.query(Job).filter(Job.recruiter_id == recruiter_id)
    if job_id is not None:
        jobs_query = jobs_query.filter(Job.id == job_id)
    jobs = jobs_query.order_by(desc(Job.created_at)).offset(max(offset, 0)).limit(min(max(limit, 1), 100)).all()
    effective_top_k = min(max(top_k, 1), 100)
    result = []
    for job in jobs:
        rec_query = db.query(Recommendation).filter(Recommendation.job_id == job.id)
        if min_score is not None:
            rec_query = rec_query.filter(Recommendation.final_score >= min_score)
        recommendations = rec_query.order_by(desc(Recommendation.final_score)).limit(effective_top_k).all()
        rec_items = []
        for row in recommendations:
            if filter_status == "unapplied":
                existing_app = db.query(Application).filter(
                    Application.job_id == job.id,
                    Application.candidate_id == row.candidate_id
                ).first()
                if existing_app:
                    continue

            cand_user = db.query(User).filter(User.id == row.candidate_id).first()
            cand_profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == row.candidate_id).first()
            rec_items.append({
                "candidate_id": row.candidate_id,
                "candidate_name": cand_user.name if cand_user else "Unknown",
                "candidate_email": cand_user.email if cand_user else "",
                "candidate_phone": cand_user.phone if cand_user else "",
                "candidate_dob": cand_profile.birth_date if cand_profile else "",
                "skills": cand_profile.skills if cand_profile else [],
                "experience_level": cand_profile.experience_level if cand_profile else "",
                "skill_match": row.skill_match,
                "preference_match": row.preference_match,
                "activity_score": row.activity_score,
                "final_score": row.final_score,
            })
        result.append(
            {
                "job_id": job.id,
                "title": job.title,
                "recommendations": rec_items,
            }
        )
    return api_ok(
        {"recruiter_id": recruiter_id, "jobs": result},
        meta={
            "offset": max(offset, 0),
            "limit": min(max(limit, 1), 100),
            "count": len(result),
            "top_k": effective_top_k,
        },
    )


@app.post("/feed/candidate/{candidate_id}/hide-job/{job_id}")
def hide_job(
    candidate_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_role(current_user, "candidate")
    if current_user.id != candidate_id:
        raise HTTPException(status_code=403, detail="Forbidden action.")
    
    existing = db.query(HiddenJob).filter(
        HiddenJob.candidate_id == candidate_id,
        HiddenJob.job_id == job_id
    ).first()
    
    if not existing:
        new_hidden = HiddenJob(candidate_id=candidate_id, job_id=job_id)
        db.add(new_hidden)
        db.commit()
    
    return api_ok({"message": "Job hidden successfully"})

@app.get("/feed/candidate/{candidate_id}")
def candidate_feed(
    candidate_id: int,
    top_k: int = 10,
    min_score: float | None = None,
    offset: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    if current_user.id != candidate_id:
        raise HTTPException(status_code=403, detail="Forbidden candidate feed.")
    rec_query = db.query(Recommendation).filter(Recommendation.candidate_id == candidate_id)
    
    # Exclude jobs the candidate has already applied to or hidden
    applied_job_subquery = db.query(Application.job_id).filter(Application.candidate_id == candidate_id)
    hidden_job_subquery = db.query(HiddenJob.job_id).filter(HiddenJob.candidate_id == candidate_id)
    rec_query = rec_query.filter(
        ~Recommendation.job_id.in_(applied_job_subquery),
        ~Recommendation.job_id.in_(hidden_job_subquery)
    )
    
    if min_score is not None:
        rec_query = rec_query.filter(Recommendation.final_score >= min_score)
    effective_limit = min(max(top_k, 1), 100)
    recommendations = (
        rec_query.order_by(desc(Recommendation.final_score), desc(Recommendation.created_at))
        .offset(max(offset, 0))
        .limit(effective_limit)
        .all()
    )
    jobs = {job.id: job for job in db.query(Job).filter(Job.id.in_([row.job_id for row in recommendations])).all()}
    now_ts = now_utc()
    valid_recommendations = [
        row
        for row in recommendations
        if row.job_id in jobs
        and (
            jobs[row.job_id].end_date is None
            or as_utc(jobs[row.job_id].end_date) >= now_ts
        )
    ]
    # Fetch candidate skills for computing matched_skills intersection
    candidate_profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_id).first()
    candidate_skill_names: set[str] = set()
    if candidate_profile and candidate_profile.skills:
        candidate_skill_names = {s.get("name", "").lower() for s in candidate_profile.skills if s.get("name")}

    return api_ok({
        "candidate_id": candidate_id,
        "items": [
            {
                "job_id": row.job_id,
                "recruiter_id": jobs[row.job_id].recruiter_id if row.job_id in jobs else None,
                "job_title": jobs[row.job_id].title if row.job_id in jobs else "Unknown",
                "brief_description": jobs[row.job_id].brief_description if row.job_id in jobs else "",
                "score": row.final_score,
                "skill_match": row.skill_match,
                "preference_match": row.preference_match,
                "activity_score": row.activity_score,
                "location": jobs[row.job_id].location if row.job_id in jobs else "",
                "salary_min": jobs[row.job_id].salary_min if row.job_id in jobs else 0,
                "salary_max": jobs[row.job_id].salary_max if row.job_id in jobs else 0,
                "experience_level": jobs[row.job_id].experience_level if row.job_id in jobs else "",
                "domain": jobs[row.job_id].domain if row.job_id in jobs else "",
                "work_mode": jobs[row.job_id].work_mode if row.job_id in jobs else "",
                "employment_type": jobs[row.job_id].employment_type if row.job_id in jobs else "",
                "required_skills": jobs[row.job_id].required_skills if row.job_id in jobs else [],
                "matched_skills": [
                    s.get("name", "") for s in (jobs[row.job_id].required_skills or [])
                    if s.get("name", "").lower() in candidate_skill_names
                ] if row.job_id in jobs else [],
                "company": _get_company_name(db, jobs[row.job_id].recruiter_id) if row.job_id in jobs else "",
                **(_get_company_contact(db, jobs[row.job_id].recruiter_id) if row.job_id in jobs else {"company_phone": "", "company_website": ""}),
                "recruiter_verified": _get_recruiter_verified(db, jobs[row.job_id].recruiter_id) if row.job_id in jobs else False,
                "external_link": jobs[row.job_id].external_link if row.job_id in jobs else "",
                "start_date": jobs[row.job_id].start_date.isoformat() if row.job_id in jobs and jobs[row.job_id].start_date else None,
                "end_date": jobs[row.job_id].end_date.isoformat() if row.job_id in jobs and jobs[row.job_id].end_date else None,
                "created_at": jobs[row.job_id].created_at.isoformat() if row.job_id in jobs and jobs[row.job_id].created_at else None,
            }
            for row in valid_recommendations
        ],
    }, meta={"offset": max(offset, 0), "limit": effective_limit, "count": len(valid_recommendations), "top_k": effective_limit})


@app.get("/activity/{candidate_id}")
def candidate_activity(
    candidate_id: int,
    event_type: str | None = None,
    offset: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_role(current_user, "candidate")
    if current_user.id != candidate_id:
        raise HTTPException(status_code=403, detail="Forbidden activity history.")
    logs_query = db.query(InteractionLog).filter(InteractionLog.user_id == candidate_id)
    if event_type:
        logs_query = logs_query.filter(InteractionLog.event_type == event_type)
    logs = (
        logs_query.order_by(desc(InteractionLog.created_at))
        .offset(max(offset, 0))
        .limit(min(max(limit, 1), 300))
        .all()
    )
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_id).first()
    return api_ok({
        "candidate_id": candidate_id,
        "status": profile.status if profile else None,
        "activity_score": profile.activity_score if profile else None,
        "logs": [
            {"event_type": row.event_type, "job_id": row.job_id, "created_at": row.created_at.isoformat()} for row in logs
        ],
    }, meta={"offset": max(offset, 0), "limit": min(max(limit, 1), 300), "count": len(logs)})


@app.get("/notifications/{user_id}")
def list_notifications(
    user_id: int,
    status: str | None = None,
    offset: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden notifications.")
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if status:
        query = query.filter(Notification.status == status)
    notifications = (
        query.order_by(desc(Notification.created_at))
        .offset(max(offset, 0))
        .limit(min(max(limit, 1), 200))
        .all()
    )
    return api_ok({
        "user_id": user_id,
        "notifications": [
            {
                "id": row.id,
                "title": row.title,
                "body": row.body,
                "status": row.status,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in notifications
        ],
    }, meta={"offset": max(offset, 0), "limit": min(max(limit, 1), 200), "count": len(notifications)})


@app.get("/notifications/{user_id}/unread-count")
def get_unread_notifications_count(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden.")
    count = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.status == "SENT"
    ).count()
    return api_ok({"unread_count": count})


@app.post("/notifications/{user_id}/read-all")
def mark_all_notifications_read(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden.")
    
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.status == "SENT"
    ).update({"status": "READ"}, synchronize_session=False)
    db.commit()
    
    return api_ok({"status": "Success"})


@app.get("/email/track-company-click")
def track_company_click(token: str, db: Session = Depends(get_db)) -> RedirectResponse:
    payload = verify_email_click_token(token)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired tracking token.")

    candidate_id = payload["candidate_id"]
    job_id = payload["job_id"]
    target_url = payload["target_url"]
    if not target_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid target URL.")

    candidate = db.query(User).filter(User.id == candidate_id, User.role == "candidate").first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")

    cooldown_hours = max(1, settings.email_click_cooldown_hours)
    cutoff = now_utc() - timedelta(hours=cooldown_hours)
    recent_clicks = (
        db.query(InteractionLog)
        .filter(
            InteractionLog.user_id == candidate_id,
            InteractionLog.job_id == job_id,
            InteractionLog.event_type == "click",
            InteractionLog.created_at >= cutoff,
        )
        .all()
    )
    already_counted = any(
        isinstance(row.event_metadata, dict) and row.event_metadata.get("source") == "email_company_link"
        for row in recent_clicks
    )

    db.add(
        InteractionLog(
            user_id=candidate_id,
            job_id=job_id,
            event_type="click",
            event_metadata={"source": "email_company_link", "target": target_url},
            created_at=now_utc(),
        )
    )

    if not already_counted:
        profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == candidate_id).first()
        if profile:
            profile.activity_score = min(1.0, (profile.activity_score or 0.0) + settings.email_click_boost)
            profile.no_response_streak = max(0, profile.no_response_streak - 1)
            profile.updated_at = now_utc()

    db.commit()
    return RedirectResponse(url=target_url, status_code=302)


@app.post("/notifications/retry-pending-emails")
def retry_pending_emails(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Retry sending email for notifications that were created but email failed (status=SENT)."""
    from app.services.email import build_notification_email, is_email_configured, send_email
    notifications = db.query(Notification).filter(Notification.status == "SENT").all()
    results = []
    for n in notifications:
        user = db.query(User).filter(User.id == n.user_id).first()
        if not user:
            continue
        if not is_email_configured():
            break
        text, html = build_notification_email(n.title, n.body)
        sent = send_email(user.email, f"[JobMatch AI] {n.title}", text, html)
        if sent:
            n.status = "EMAIL_SENT"
            db.commit()
        results.append({"notification_id": n.id, "user_id": n.user_id, "email_sent": sent})
    return api_ok({"retried": len(results), "results": results})


@app.post("/evaluate")
def evaluate_system(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    require_role(current_user, "recruiter")
    quality = precision_recall_at_k(db, k=5)
    engagement = engagement_metrics(db)
    comparison = compare_baseline_vs_improved(db, k=5)
    return api_ok({"recommendation_quality": quality, "engagement": engagement, "model_comparison": comparison})


@app.get("/ui/recruiter/{recruiter_id}", response_class=HTMLResponse)
def recruiter_ui(
    recruiter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> str:
    payload = recruiter_dashboard(recruiter_id=recruiter_id, db=db, current_user=current_user)["data"]
    rows = []
    for job_block in payload["jobs"]:
        for rec in job_block["recommendations"]:
            rows.append(
                "<tr>"
                f"<td>{job_block['job_id']}</td>"
                f"<td>{job_block['title']}</td>"
                f"<td>{rec['candidate_id']}</td>"
                f"<td>{rec['skill_match']:.3f}</td>"
                f"<td>{rec['preference_match']:.3f}</td>"
                f"<td>{rec['activity_score']:.3f}</td>"
                f"<td>{rec['final_score']:.3f}</td>"
                "</tr>"
            )
    content = """
    <html><body>
    <h1>Recruiter Dashboard</h1>
    <table border="1" cellpadding="6">
      <tr><th>Job ID</th><th>Title</th><th>Candidate</th><th>Skill</th><th>Preference</th><th>Activity</th><th>Final</th></tr>
      %s
    </table>
    </body></html>
    """ % (
        "".join(rows) if rows else "<tr><td colspan='7'>No recommendations yet.</td></tr>"
    )
    return content


@app.get("/ui/candidate/{candidate_id}", response_class=HTMLResponse)
def candidate_ui(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> str:
    payload = candidate_feed(candidate_id=candidate_id, db=db, current_user=current_user)["data"]
    rows = []
    for item in payload["items"]:
        rows.append(
            "<tr>"
            f"<td>{item['job_id']}</td>"
            f"<td>{item['job_title']}</td>"
            f"<td>{item['score']:.3f}</td>"
            f"<td>{item['skill_match']:.3f}</td>"
            f"<td>{item['preference_match']:.3f}</td>"
            f"<td>{item['activity_score']:.3f}</td>"
            "</tr>"
        )
    content = """
    <html><body>
    <h1>Candidate Job Feed</h1>
    <a href="/ui/candidate/%d/activity">View Activity History</a>
    <table border="1" cellpadding="6">
      <tr><th>Job ID</th><th>Job</th><th>Final</th><th>Skill</th><th>Preference</th><th>Activity</th></tr>
      %s
    </table>
    </body></html>
    """ % (
        candidate_id,
        "".join(rows) if rows else "<tr><td colspan='6'>No recommendations yet.</td></tr>",
    )
    return content


@app.get("/ui/candidate/{candidate_id}/activity", response_class=HTMLResponse)
def candidate_activity_ui(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> str:
    payload = candidate_activity(candidate_id=candidate_id, db=db, current_user=current_user)["data"]
    rows = []
    for row in payload["logs"]:
        rows.append("<tr>" f"<td>{row['event_type']}</td><td>{row['job_id'] or ''}</td><td>{row['created_at']}</td>" "</tr>")
    content = """
    <html><body>
    <h1>Candidate Activity History</h1>
    <p>Status: %s</p>
    <p>Activity Score: %s</p>
    <table border="1" cellpadding="6">
      <tr><th>Event</th><th>Job ID</th><th>Time</th></tr>
      %s
    </table>
    </body></html>
    """ % (
        payload["status"] or "UNKNOWN",
        f"{payload['activity_score']:.3f}" if payload["activity_score"] is not None else "N/A",
        "".join(rows) if rows else "<tr><td colspan='3'>No interactions.</td></tr>",
    )
    return content
