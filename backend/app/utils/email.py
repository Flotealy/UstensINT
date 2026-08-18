"""
Utilitaires email — Validation de domaine, déduction du nom et envoi SMTP.
"""

import asyncio
import json
import logging
import smtplib
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.setting import Setting

logger = logging.getLogger("uvicorn.error")


def deduce_display_name(email: str) -> str:
    """Deduce a display name from an email address.

    Example: 'prenom.nom@telecom-sudparis.eu' → 'Prénom Nom'
    """
    local_part = email.split("@")[0]
    # Replace dots, hyphens and underscores with spaces, then title-case
    name = local_part.replace(".", " ").replace("-", " ").replace("_", " ")
    return name.title()


async def get_allowed_domains(db: AsyncSession) -> list[str] | None:
    """Get the list of allowed email domains.

    Priority:
    1. Environment variable (USTENSINT_ALLOWED_DOMAINS)
    2. Database setting (allowed_domains)
    Returns None if all domains are allowed.
    """
    # 1. Check env variable
    if settings.allowed_domains:
        return [d.strip() for d in settings.allowed_domains.split(",") if d.strip()]

    # 2. Check database
    result = await db.execute(
        select(Setting.value).where(Setting.key == "allowed_domains")
    )
    row = result.scalar_one_or_none()
    if row:
        try:
            domains = json.loads(row)
            if isinstance(domains, list) and domains:
                return domains
        except (json.JSONDecodeError, TypeError):
            pass

    return None  # Allow all domains


async def validate_email_domain(email: str, db: AsyncSession) -> bool:
    """Check if the email domain is in the allowed list."""
    if "@" not in email:
        return False
    domain = email.split("@")[1].lower()
    allowed = await get_allowed_domains(db)

    if allowed is None:
        return True  # All domains allowed

    return domain in [d.lower() for d in allowed]


def _send_smtp_sync(
    to_addr: str,
    subject: str,
    html_content: str,
    text_content: str = "",
) -> None:
    """Synchronous SMTP email sending executed inside a worker thread."""
    if not settings.smtp_host:
        logger.warning(
            f"[SMTP] Aucun serveur SMTP configuré (SMTP_HOST vide). Email simulé vers {to_addr}:\nSujet: {subject}\n{text_content}"
        )
        return

    from_addr = settings.smtp_from or settings.smtp_user or f"noreply@{settings.smtp_host}"
    domain = from_addr.split("@")[1] if "@" in from_addr else (settings.smtp_host or "florianriviere.com")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"Cook'It <{from_addr}>"
    msg["To"] = to_addr
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=domain)
    msg.set_content(text_content or "Veuillez activer la vue HTML pour lire cet email.")

    if html_content:
        msg.add_alternative(html_content, subtype="html")

    try:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=12) as server:
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=12) as server:
                server.ehlo()
                if settings.smtp_tls and server.has_extn("STARTTLS"):
                    server.starttls()
                    server.ehlo()
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        logger.info(f"[SMTP] Email envoyé avec succès à {to_addr} (Sujet: {subject})")
    except Exception as e:
        logger.error(f"[SMTP] Erreur lors de l'envoi de l'email à {to_addr}: {e}")
        raise


async def send_email(
    to_addr: str,
    subject: str,
    html_content: str,
    text_content: str = "",
) -> None:
    """Send an email asynchronously without blocking the event loop."""
    await asyncio.to_thread(_send_smtp_sync, to_addr, subject, html_content, text_content)


async def send_otp_email(to_addr: str, code: str, expires_in_minutes: int = 10) -> None:
    """Send a stylized Cook'It 6-character OTP verification email."""
    subject = f"🍳 Votre code de connexion Cook'It : {code}"
    
    text_content = (
        f"Bonjour,\n\n"
        f"Votre code d'authentification pour Cook'It est : {code}\n\n"
        f"Ce code est valable pendant {expires_in_minutes} minutes et ne peut être utilisé qu'une seule fois.\n"
        f"Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.\n\n"
        f"— L'équipe Cook'It Télécom SudParis"
    )

    html_content = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code de connexion Cook'It</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1f24; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1f24; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background: #102a31; border: 1px solid rgba(72, 188, 188, 0.2); border-radius: 16px; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.35);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; background: linear-gradient(180deg, rgba(72, 188, 188, 0.12) 0%, rgba(16, 42, 49, 0) 100%);">
              <div style="font-size: 32px; line-height: 1; margin-bottom: 8px;">🍳</div>
              <h1 style="margin: 0; color: #48bcbc; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Cook'It</h1>
              <p style="margin: 4px 0 0 0; color: #8fa8ad; font-size: 13px;">Télécom SudParis</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 10px 32px 32px 32px; text-align: center;">
              <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 19px; font-weight: 600;">Votre code de connexion</h2>
              <p style="margin: 0 0 24px 0; color: #b4c9ce; font-size: 14.5px; line-height: 1.5;">
                Voici votre code de sécurité pour vous connecter à la plateforme de réservation :
              </p>
              
              <!-- OTP Box -->
              <div style="background: #06161a; border: 2px dashed #48bcbc; border-radius: 12px; padding: 18px 24px; margin: 0 auto 24px auto; display: inline-block;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ffb03a; display: block;">{code}</span>
              </div>

              <p style="margin: 0 0 8px 0; color: #8fa8ad; font-size: 13.5px;">
                ⏱ Ce code expire dans <strong>{expires_in_minutes} minutes</strong> et n'est valable qu'une seule fois.
              </p>
              <p style="margin: 0; color: #6b868c; font-size: 12px; line-height: 1.4;">
                Si vous n'avez pas demandé ce code, ignorez simplement cet email. La sécurité de votre compte n'est pas compromise.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px; background: #0b1e23; border-top: 1px solid rgba(72, 188, 188, 0.1); text-align: center;">
              <p style="margin: 0; color: #5a757b; font-size: 11.5px;">
                UstensINT — Club Cook'It &copy; 2026 Télécom SudParis
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    await send_email(
        to_addr=to_addr,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
    )
