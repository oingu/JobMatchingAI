import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./job_matching.db")
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    backend_base_url: str = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000")
    tracking_secret: str = os.getenv("TRACKING_SECRET", "dev-tracking-secret")
    email_click_boost: float = float(os.getenv("EMAIL_CLICK_BOOST", "0.08"))
    email_click_cooldown_hours: int = _env_int("EMAIL_CLICK_COOLDOWN_HOURS", 24)
    email_click_token_ttl_hours: int = _env_int("EMAIL_CLICK_TOKEN_TTL_HOURS", 72)
    token_expire_minutes: int = _env_int("TOKEN_EXPIRE_MINUTES", 1440)
    max_event_retry: int = _env_int("MAX_EVENT_RETRY", 3)
    passive_throttle_hours: int = _env_int("PASSIVE_THROTTLE_HOURS", 24)
    score_w1: float = float(os.getenv("SCORE_W1", "0.5"))
    score_w2: float = float(os.getenv("SCORE_W2", "0.3"))
    score_w3: float = float(os.getenv("SCORE_W3", "0.2"))
    behavior_lambda: float = float(os.getenv("BEHAVIOR_LAMBDA", "0.12"))
    behavior_passive_streak: int = _env_int("BEHAVIOR_PASSIVE_STREAK", 3)
    behavior_inactive_streak: int = _env_int("BEHAVIOR_INACTIVE_STREAK", 6)
    matching_strategy: str = os.getenv("MATCHING_STRATEGY", "proficiency")  # proficiency | tfidf | embedding | set
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    cohere_api_key: str = os.getenv("COHERE_API_KEY", "")
    cohere_embed_model: str = os.getenv("COHERE_EMBED_MODEL", "embed-multilingual-v3.0")
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    openrouter_model: str = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
    cv_parser_mode: str = os.getenv("CV_PARSER_MODE", "auto")  # auto | openrouter | gemini | regex
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = _env_int("SMTP_PORT", 587)
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_pass: str = os.getenv("SMTP_PASS", "")
    smtp_from_name: str = os.getenv("SMTP_FROM_NAME", "JobMatch AI")
    notification_score_threshold: float = float(os.getenv("NOTIFICATION_SCORE_THRESHOLD", "0.5"))


settings = Settings()
