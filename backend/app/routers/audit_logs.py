"""
Router — Journal d'Audit (Audit Logs).
Accessible aux utilisateurs avec rôle Mandat (moderator) ou Administrateur.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_moderator
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogOut

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=list[AuditLogOut])
async def list_audit_logs(
    search: str | None = None,
    action: str | None = None,
    target_type: str | None = None,
    limit: int = Query(default=150, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Lister les entrées du journal d'audit triées par date décroissante."""
    stmt = select(AuditLog)

    if action:
        stmt = stmt.where(AuditLog.action == action)

    if target_type:
        stmt = stmt.where(AuditLog.target_type == target_type)

    if search:
        search_term = f"%{search}%"
        stmt = stmt.where(
            or_(
                AuditLog.user_email.ilike(search_term),
                AuditLog.user_name.ilike(search_term),
                AuditLog.action.ilike(search_term),
                AuditLog.details.ilike(search_term),
                AuditLog.target_id.ilike(search_term),
            )
        )

    result = await db.execute(stmt.order_by(AuditLog.created_at.desc()).limit(limit))
    return list(result.scalars().all())
