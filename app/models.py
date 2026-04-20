from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base
from app.utils.time import now_utc


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    password = Column(String(255), default="changeme", nullable=False)
    role = Column(String(20), nullable=False)  # candidate | recruiter | admin
    phone = Column(String(30), default="", nullable=False)
    date_of_birth = Column(String(20), default="", nullable=False)
    is_online = Column(Boolean, default=False, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    otp = Column(String(6), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    skills = Column(JSON, default=[], nullable=False)  # [{name, level}] level 1-5
    experience_level = Column(String(50), default="junior", nullable=False)
    preferred_locations = Column(Text, default="", nullable=False)
    preferred_salary_min = Column(Integer, default=0, nullable=False)
    avatar_url = Column(String(500), default="", nullable=False)
    cover_url = Column(String(500), default="", nullable=False)
    bio = Column(Text, default="", nullable=False)
    education = Column(JSON, default=[], nullable=False)  # [{school, degree, period}]
    experiences = Column(JSON, default=[], nullable=False)  # [{company, role, period, description}]
    status = Column(String(20), default="ACTIVE", nullable=False)
    activity_score = Column(Float, default=1.0, nullable=False)
    no_response_streak = Column(Integer, default=0, nullable=False)
    last_notified_at = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    user = relationship("User")


class RecruiterProfile(Base):
    __tablename__ = "recruiter_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    company_name = Column(String(255), nullable=False)
    company_website = Column(String(255), default="", nullable=False)
    company_phone = Column(String(30), default="", nullable=False)
    company_fax = Column(String(30), default="", nullable=False)
    avatar_url = Column(String(500), default="", nullable=False)
    cover_url = Column(String(500), default="", nullable=False)
    bio = Column(Text, default="", nullable=False)
    company_address = Column(String(500), default="", nullable=False)
    overview = Column(JSON, default=[], nullable=False)  # [{title, value}]
    tax_id = Column(String(100), default="", nullable=False)
    business_license_path = Column(String(500), default="", nullable=False)
    verification_status = Column(String(30), default="UNVERIFIED", nullable=False)  # UNVERIFIED | PENDING_REVIEW | VERIFIED | REJECTED
    verification_note = Column(Text, default="", nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    user = relationship("User")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    recruiter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    required_skills = Column(JSON, default=[], nullable=False)  # [{name, level}] level 1-5
    location = Column(String(100), default="", nullable=False)
    salary_min = Column(Integer, default=0, nullable=False)
    salary_max = Column(Integer, default=0, nullable=False)
    experience_level = Column(String(50), default="junior", nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    recruiter = relationship("User")


class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        UniqueConstraint("source_event_id", "job_id", "candidate_id", name="uq_recommendation_event_job_candidate"),
    )

    id = Column(Integer, primary_key=True, index=True)
    source_event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    skill_match = Column(Float, nullable=False)
    preference_match = Column(Float, nullable=False)
    activity_score = Column(Float, nullable=False)
    final_score = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)


class InteractionLog(Base):
    __tablename__ = "interaction_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)
    event_type = Column(String(30), nullable=False)  # view click apply login
    event_metadata = Column(JSON, default={}, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    idempotency_key = Column(String(255), unique=True, nullable=True)
    status = Column(String(20), default="SENT", nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100), nullable=False)
    payload = Column(JSON, default={}, nullable=False)
    status = Column(String(20), default="PENDING", nullable=False)
    retry_count = Column(Integer, default=0, nullable=False)
    last_error = Column(Text, default="", nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("candidate_id", "job_id", name="uq_application_candidate_job"),
    )

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    cover_letter = Column(Text, default="", nullable=False)
    status = Column(String(20), default="PENDING", nullable=False)  # PENDING | REVIEWED | ACCEPTED | REJECTED | WITHDRAWN
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    candidate = relationship("User", foreign_keys=[candidate_id])
    job = relationship("Job")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(120), nullable=False)
    resource_type = Column(String(80), nullable=False)
    resource_id = Column(String(80), nullable=True)
    detail = Column(JSON, default={}, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
