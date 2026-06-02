"""Email sending service using SMTP.

Sends real emails when SMTP is configured. Falls back to logging when
SMTP credentials are not provided (development mode).
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape
import re

from app.config import settings

logger = logging.getLogger(__name__)


def is_email_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_pass)


def send_email(to_email: str, subject: str, body_text: str, body_html: str | None = None) -> bool:
    """Send an email. Returns True on success, False on failure."""
    if not is_email_configured():
        logger.info("SMTP not configured — email to %s skipped: %s", to_email, subject)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    msg["To"] = to_email

    msg.attach(MIMEText(body_text, "plain"))
    if body_html:
        msg.attach(MIMEText(body_html, "html"))

    # Strip spaces from App Password (Gmail shows them in groups of 4 but SMTP needs clean string)
    smtp_pass = settings.smtp_pass.replace(" ", "")
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.smtp_user, smtp_pass)
            server.sendmail(settings.smtp_user, to_email, msg.as_string())
        logger.info("Email sent to %s: %s", to_email, subject)
        return True
    except smtplib.SMTPAuthenticationError as exc:
        logger.error("SMTP authentication failed — check SMTP_USER/SMTP_PASS in .env: %s", exc)
        return False
    except smtplib.SMTPException as exc:
        logger.error("SMTP error sending to %s: %s", to_email, exc)
        return False
    except (OSError, smtplib.SMTPConnectError) as exc:
        logger.warning("SMTP connection blocked or unreachable (commonly blocked on cloud free tiers like Render): %s", exc)
        return False
    except Exception:
        logger.exception("Unexpected error sending email to %s", to_email)
        return False


def build_notification_email(title: str, body: str) -> tuple[str, str]:
    """Build plain-text and HTML versions of a notification email."""
    # Clean markdown links for plain text version
    clean_body = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'\1 (\2)', body)
    text = f"{title}\n\n{clean_body}\n\n— JobMatch AI"

    lines = [line.strip() for line in body.splitlines() if line.strip()]
    structured_rows: list[str] = []
    paragraph_rows: list[str] = []
    for line in lines:
        if ":" in line:
            key, value = line.split(":", 1)
            if key.strip() and value.strip():
                value_str = value.strip()
                match = re.search(r'^\[([^\]]+)\]\((https?://[^)]+)\)$', value_str)
                if match:
                    display_text = escape(match.group(1))
                    href = escape(match.group(2), quote=True)
                    value_html = f'<a href="{href}" style="color:#0f172a;text-decoration:underline;">{display_text}</a>'
                elif value_str.startswith(("http://", "https://")):
                    safe_url = escape(value_str, quote=True)
                    value_html = (
                        f'<a href="{safe_url}" style="color:#0f172a;text-decoration:underline;">'
                        f"{escape(value_str)}</a>"
                    )
                else:
                    value_html = escape(value_str)
                structured_rows.append(
                    f"""
    <tr>
      <td style="padding: 8px 0; width: 120px; vertical-align: top; color: #475569; font-size: 13px; font-weight: 600;">{escape(key.strip())}</td>
      <td style="padding: 8px 0; vertical-align: top; color: #0f172a; font-size: 14px; font-weight: 500;">{value_html}</td>
    </tr>"""
                )
                continue
        paragraph_rows.append(
            f'<p style="margin: 0 0 10px 0; color: #334155; font-size: 14px; line-height: 1.6; text-align: left;">{escape(line)}</p>'
        )

    html = f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
      <div style="background: #0f172a; color: white; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold;">⚡</div>
      <span style="font-size: 14px; font-weight: 600; color: #0f172a;">JobMatch AI</span>
    </div>
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px; text-align: left;">{escape(title)}</h2>
    <div style="margin: 0 0 14px 0;">{"".join(paragraph_rows)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin: 0 0 18px 0; text-align: left;">
      {"".join(structured_rows)}
    </table>
    <a href="{settings.frontend_origin}/login"
       style="display: inline-block; background: #0f172a; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
      Open JobMatch AI
    </a>
  </div>
  <p style="color: #94a3b8; font-size: 12px; margin-top: 16px; text-align: center;">
    You received this email because you have an account on JobMatch AI.
  </p>
</body>
</html>"""
    return text, html


def build_otp_email(otp: str, name: str) -> tuple[str, str]:
    """Build plain-text and HTML versions of an OTP verification email."""
    text = (
        f"Hi {name},\n\n"
        f"Your verification code is: {otp}\n\n"
        f"This code expires in 10 minutes.\n\n"
        f"— JobMatch AI"
    )

    html = f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="background: #f8fafc; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; text-align: center;">
    <div style="margin-bottom: 20px;">
      <div style="background: #0f172a; color: white; width: 40px; height: 40px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold;">⚡</div>
    </div>
    <h2 style="margin: 0 0 8px 0; color: #0f172a; font-size: 20px;">Verify your email</h2>
    <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px;">
      Hi {name}, enter this code to complete your registration:
    </p>
    <div style="background: #0f172a; color: white; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 16px 32px; border-radius: 12px; display: inline-block; font-family: monospace;">
      {otp}
    </div>
    <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 12px;">
      This code expires in 10 minutes. If you didn't create an account, ignore this email.
    </p>
  </div>
</body>
</html>"""
    return text, html
