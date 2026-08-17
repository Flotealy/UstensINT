"""
Service de journalisation d'audit (Audit Logging).
Enregistre les actions des utilisateurs de façon structurée et conforme au RGPD.
"""

import json
import logging
from typing import Any
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


def sanitize_ip(ip: str | None) -> str | None:
    """Anonymise partiellement l'adresse IP pour respecter le RGPD (masquage du dernier octet)."""
    if not ip:
        return None
    if "." in ip:  # IPv4
        parts = ip.split(".")
        if len(parts) == 4:
            return f"{parts[0]}.{parts[1]}.{parts[2]}.0"
    elif ":" in ip:  # IPv6
        parts = ip.split(":")
        if len(parts) >= 4:
            return f"{':'.join(parts[:3])}::"
    return ip


async def log_audit(
    db: AsyncSession,
    action: str,
    target_type: str,
    user: User | None = None,
    user_email: str | None = None,
    user_name: str | None = None,
    target_id: str | uuid.UUID | None = None,
    details: dict[str, Any] | str | None = None,
    request: Request | None = None,
) -> AuditLog:
    """Créer et persister une entrée dans le journal d'audit."""
    try:
        ip_addr = None
        if request:
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                ip_addr = forwarded.split(",")[0].strip()
            elif request.client:
                ip_addr = request.client.host
        
        details_str = None
        if details is not None:
            if isinstance(details, dict):
                details_str = json.dumps(details, ensure_ascii=False)
            else:
                details_str = str(details)

        target_id_str = str(target_id) if target_id is not None else None
        u_id = user.id if user else None
        u_email = user.email if user else user_email
        u_name = user.display_name if user else user_name

        entry = AuditLog(
            user_id=u_id,
            user_email=u_email,
            user_name=u_name,
            action=action,
            target_type=target_type,
            target_id=target_id_str,
            details=details_str,
            ip_address=sanitize_ip(ip_addr),
        )
        db.add(entry)
        # Flush to register within current transaction
        await db.flush()
        return entry
    except Exception as exc:
        logger.error("Erreur lors de l'enregistrement du log d'audit: %s", exc)
