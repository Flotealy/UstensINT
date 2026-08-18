"""
Service de notifications — un seul point d'entrée pour tous les événements.

Chaque événement peut être diffusé sur deux canaux, activables indépendamment
depuis l'administration :
  - « email »   : envoi SMTP aux destinataires concernés ;
  - « discord » : envoi d'un embed sur un ou plusieurs webhooks Discord.

Les envois ne lèvent jamais d'exception vers l'appelant : une notification
ratée ne doit jamais faire échouer une réservation.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setting import Setting
from app.models.user import User
from app.utils.email import send_email

logger = logging.getLogger("uvicorn.error")

# --- Événements gérés -------------------------------------------------------

EVENTS: tuple[str, ...] = (
    "new_reservation",
    "approval",
    "reminder",
    "overdue",
    "stock_alert",
)

# Couleur de l'embed Discord par événement.
EVENT_COLORS: dict[str, int] = {
    "new_reservation": 0x0D6284,
    "approval": 0x48BCBC,
    "reminder": 0xD97706,
    "overdue": 0xD23C3C,
    "stock_alert": 0x7C3AED,
}

# Statuts de stock qui déclenchent une alerte.
STOCK_ALERT_STATUSES: tuple[str, ...] = ("À réapprovisionner", "Périmé")

DISCORD_WEBHOOK_RE = re.compile(
    r"^https://(canary\.|ptb\.)?discord(app)?\.com/api/webhooks/\d+/[\w-]+$"
)

_HTTP_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


# --- Lecture des paramètres -------------------------------------------------


def _as_bool(raw: str | None, default: bool = False) -> bool:
    if raw is None or raw == "":
        return default
    return str(raw).strip().lower() in ("true", "1", "yes", "oui")


async def load_settings(db: AsyncSession) -> dict[str, str]:
    result = await db.execute(select(Setting))
    return {setting.key: setting.value for setting in result.scalars().all()}


@dataclass(slots=True)
class Webhook:
    name: str
    url: str

    def as_dict(self) -> dict[str, str]:
        return {"name": self.name, "url": self.url}


def parse_webhooks(raw: str | None, legacy_single: str | None = None) -> list[Webhook]:
    """Lire la liste des webhooks Discord.

    Tolère trois formats : la liste JSON d'objets {name, url}, une liste JSON de
    chaînes, et l'ancien paramètre mono-webhook `discord_webhook_url`.
    """
    hooks: list[Webhook] = []
    seen: set[str] = set()

    def push(name: str, url: str) -> None:
        url = (url or "").strip()
        if not url or url in seen:
            return
        seen.add(url)
        hooks.append(Webhook(name=(name or "").strip() or "Discord", url=url))

    if raw:
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            parsed = None
        if isinstance(parsed, list):
            for entry in parsed:
                if isinstance(entry, dict):
                    push(str(entry.get("name", "")), str(entry.get("url", "")))
                elif isinstance(entry, str):
                    push("Discord", entry)

    if legacy_single:
        push("Discord", legacy_single)

    return hooks


def is_valid_webhook_url(url: str) -> bool:
    return bool(DISCORD_WEBHOOK_RE.match((url or "").strip()))


async def staff_emails(db: AsyncSession) -> list[str]:
    """Adresses du mandat et des administrateurs (destinataires des alertes internes)."""
    result = await db.execute(
        select(User.email).where(
            User.role.in_(["admin", "moderator"]), User.is_blocked.is_(False)
        )
    )
    return [row[0] for row in result if row[0]]


# --- Construction & envoi ---------------------------------------------------


@dataclass(slots=True)
class Notification:
    """Message prêt à partir, indépendant de toute session de base de données."""

    event: str
    title: str
    summary: str
    fields: list[tuple[str, str]] = field(default_factory=list)
    email_to: list[str] = field(default_factory=list)
    webhooks: list[Webhook] = field(default_factory=list)
    color: int = 0x0D6284

    @property
    def has_targets(self) -> bool:
        return bool(self.email_to or self.webhooks)


async def build_notification(
    db: AsyncSession,
    event: str,
    *,
    title: str,
    summary: str,
    fields: list[tuple[str, str]] | None = None,
    email_to: list[str] | None = None,
    include_staff: bool = False,
) -> Notification | None:
    """Résoudre les canaux actifs pour un événement et préparer le message.

    Retourne None si l'événement est désactivé ou sans destinataire : l'appelant
    n'a alors rien à envoyer.
    """
    if event not in EVENTS:
        raise ValueError(f"Événement de notification inconnu : {event}")

    values = await load_settings(db)

    # Interrupteur général (l'ancienne clé sert de repli).
    master = _as_bool(
        values.get("notifications_enabled")
        or values.get("email_notifications_enabled"),
        True,
    )
    if not master:
        return None

    email_on = _as_bool(
        values.get(f"notify_{event}_email") or values.get(f"email_notify_{event}"),
        True,
    )
    discord_on = _as_bool(values.get(f"notify_{event}_discord"), False)

    recipients: list[str] = []
    if email_on:
        recipients = [addr for addr in (email_to or []) if addr]
        if include_staff:
            recipients.extend(await staff_emails(db))
        # Dédoublonnage en conservant l'ordre.
        recipients = list(dict.fromkeys(addr.strip().lower() for addr in recipients))

    hooks: list[Webhook] = []
    if discord_on:
        hooks = parse_webhooks(
            values.get("discord_webhooks"), values.get("discord_webhook_url")
        )

    notification = Notification(
        event=event,
        title=title,
        summary=summary,
        fields=list(fields or []),
        email_to=recipients,
        webhooks=hooks,
        color=EVENT_COLORS.get(event, 0x0D6284),
    )
    return notification if notification.has_targets else None


def _discord_payload(notification: Notification) -> dict:
    return {
        "username": "UstensINT — Cook'It",
        "embeds": [
            {
                "title": notification.title[:256],
                "description": notification.summary[:4096],
                "color": notification.color,
                "fields": [
                    {"name": name[:256], "value": (value or "—")[:1024], "inline": True}
                    for name, value in notification.fields[:25]
                ],
                "footer": {"text": "UstensINT — Club Cook'It"},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }


async def post_discord(url: str, payload: dict) -> None:
    """Publier sur un webhook Discord. Lève une exception explicite en cas d'échec."""
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        response = await client.post(url, json=payload)

    if response.status_code == 429:
        raise RuntimeError("Discord a limité les envois (429). Réessayez dans un instant.")
    if response.status_code >= 400:
        detail = response.text.strip()[:300] or "aucun détail"
        raise RuntimeError(f"Discord a répondu {response.status_code} : {detail}")


async def send_test_discord(url: str) -> None:
    """Envoyer un message de test sur un webhook (utilisé par l'administration)."""
    if not is_valid_webhook_url(url):
        raise ValueError(
            "URL de webhook invalide. Elle doit ressembler à "
            "https://discord.com/api/webhooks/<id>/<token>"
        )

    await post_discord(
        url,
        _discord_payload(
            Notification(
                event="new_reservation",
                title="Test de webhook réussi",
                summary=(
                    "Ce salon est bien relié à UstensINT : les notifications "
                    "activées dans l'administration arriveront ici."
                ),
                fields=[("Source", "Paramètres → Notifications")],
                color=0x48BCBC,
            )
        ),
    )


def render_email(notification: Notification) -> tuple[str, str]:
    """Construire les variantes texte et HTML d'une notification."""
    lines = [notification.summary, ""]
    lines += [f"- {name} : {value}" for name, value in notification.fields]
    lines += ["", "— L'équipe Cook'It Télécom SudParis"]
    text = "\n".join(lines)

    rows = "".join(
        f"""<tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;width:45%;">{name}</td>
          <td style="padding:6px 0;color:#0f172a;font-size:13.5px;font-weight:600;">{value}</td>
        </tr>"""
        for name, value in notification.fields
    )

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:24px 24px 18px 24px;border-bottom:2px solid #0d9488;">
            <h1 style="margin:0;color:#0f766e;font-size:20px;font-weight:700;">{notification.title}</h1>
            <p style="margin:3px 0 0 0;color:#64748b;font-size:12.5px;">UstensINT — Club Cook'It</p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 24px;">
            <p style="margin:0 0 16px 0;color:#334155;font-size:14.5px;line-height:1.55;">{notification.summary}</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">{rows}</table>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11.5px;">Message automatique — Télécom SudParis</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
    return html, text


async def send_notification(notification: Notification) -> None:
    """Diffuser une notification sur tous ses canaux. N'échoue jamais bruyamment."""
    html, text = render_email(notification)

    tasks: list[asyncio.Future] = []
    for address in notification.email_to:
        tasks.append(
            asyncio.ensure_future(
                send_email(address, f"Cook'It — {notification.title}", html, text)
            )
        )

    payload = _discord_payload(notification)
    for hook in notification.webhooks:
        tasks.append(asyncio.ensure_future(post_discord(hook.url, payload)))

    if not tasks:
        return

    results = await asyncio.gather(*tasks, return_exceptions=True)
    for outcome in results:
        if isinstance(outcome, BaseException):
            logger.error(
                "[NOTIFY] Échec d'envoi (%s) : %s", notification.event, outcome
            )
