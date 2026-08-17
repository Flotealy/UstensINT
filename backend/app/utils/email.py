"""
Utilitaires email — Validation de domaine et déduction du nom.
"""

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.setting import Setting


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
    domain = email.split("@")[1].lower()
    allowed = await get_allowed_domains(db)

    if allowed is None:
        return True  # All domains allowed

    return domain in [d.lower() for d in allowed]
