import smtplib
import ssl
from email.message import EmailMessage
from app.config import settings

def send_email(to_email: str, subject: str, body: str):
    if not settings.smtp_host or not settings.smtp_user or not settings.smtp_pass:
        print(f"Mock sending email to {to_email}: {subject}")
        return

    msg = EmailMessage()
    msg.set_content(body)
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    msg["To"] = to_email

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls(context=context)
            server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(msg)
    except Exception as e:
        print(f"Failed to send email: {e}")
