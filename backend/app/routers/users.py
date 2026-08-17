"""
Router — Utilisateurs (Admin).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin, get_current_user
from app.models.user import User
from app.schemas.auth import UserPublic
from app.schemas.user import UserUpdate
from app.services.audit import log_audit

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserPublic])
async def list_users(
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Lister tous les utilisateurs (Admin)."""
    stmt = select(User)
    
    if search:
        search_term = f"%{search}%"
        stmt = stmt.where(or_(
            User.email.ilike(search_term),
            User.display_name.ilike(search_term)
        ))
        
    result = await db.execute(stmt.order_by(User.email))
    return list(result.scalars().all())


@router.patch("/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Modifier le rôle ou le statut de blocage d'un utilisateur (Admin)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
        
    update_details = {}
    if body.role is not None:
        if body.role not in ["user", "moderator", "admin"]:
            raise HTTPException(status_code=400, detail="Rôle invalide.")
        update_details["role"] = body.role
        user.role = body.role
        
    if body.is_blocked is not None:
        update_details["is_blocked"] = body.is_blocked
        user.is_blocked = body.is_blocked
        
    from app.services.audit import log_audit
    await log_audit(
        db=db,
        user=admin,
        action="USER_UPDATE",
        target_type="user",
        target_id=user.id,
        details={"target_email": user.email, **update_details},
    )
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me/export")
async def export_my_data(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """RGPD : Exporter les données personnelles de l'utilisateur."""
    from app.models.reservation import Reservation
    
    res_result = await db.execute(
        select(Reservation).where(Reservation.user_id == user.id)
    )
    reservations = res_result.scalars().all()
    
    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "display_name": user.display_name,
            "phone": user.phone,
            "role": user.role,
            "created_at": user.created_at.isoformat(),
        },
        "reservations": [
            {
                "id": str(r.id),
                "start_date": r.start_date.isoformat() if r.start_date else None,
                "end_date": r.end_date.isoformat() if r.end_date else None,
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r in reservations
        ]
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """RGPD : Droit à l'oubli. Anonymiser ou supprimer l'utilisateur."""
    # Anonymization is generally preferred to keep reservation history intact for audit
    user.email = f"deleted_{uuid.uuid4()}@telecom-sudparis.eu"
    user.display_name = "Utilisateur Supprimé"
    user.phone = None
    user.is_blocked = True # Block from logging in again
    
    await db.commit()
    return None
