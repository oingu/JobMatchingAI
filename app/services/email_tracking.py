import base64
import hashlib
import hmac
import json
from urllib.parse import quote

from app.config import settings
from app.utils.time import now_utc


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(payload_b64: str) -> str:
    mac = hmac.new(
        settings.tracking_secret.encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).digest()
    return _b64url_encode(mac)


def create_email_click_token(candidate_id: int, job_id: int, target_url: str) -> str:
    now = now_utc()
    payload = {
        "candidate_id": candidate_id,
        "job_id": job_id,
        "target_url": target_url,
        "exp": int(now.timestamp()) + (settings.email_click_token_ttl_hours * 3600),
    }
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    return f"{payload_b64}.{_sign(payload_b64)}"


def verify_email_click_token(token: str) -> dict | None:
    if "." not in token:
        return None
    payload_b64, sig = token.split(".", 1)
    expected = _sign(payload_b64)
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        payload = json.loads(_b64url_decode(payload_b64).decode())
    except Exception:
        return None
    exp = payload.get("exp")
    if not isinstance(exp, int):
        return None
    if int(now_utc().timestamp()) > exp:
        return None
    if not isinstance(payload.get("candidate_id"), int):
        return None
    if not isinstance(payload.get("job_id"), int):
        return None
    target_url = payload.get("target_url", "")
    if not isinstance(target_url, str) or not target_url.strip():
        return None
    return payload


def build_email_click_tracking_url(candidate_id: int, job_id: int, target_url: str) -> str:
    token = create_email_click_token(candidate_id=candidate_id, job_id=job_id, target_url=target_url)
    return f"{settings.backend_base_url}/email/track-company-click?token={quote(token)}"
