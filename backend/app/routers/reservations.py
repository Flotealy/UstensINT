"""
Router — Réservations.
"""

from datetime import date, datetime, timezone
import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_moderator
from app.models.equipment import Equipment
from app.models.reservation import Reservation, ReservationItem
from app.models.setting import Setting
from app.models.user import User
from app.schemas.reservation import (
    ReservationCreate,
    ReservationDetail,
    ReservationPublic,
    ReservationUpdate,
)
from app.services.audit import log_audit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reservations", tags=["Reservations"])


def _as_bool(raw: str | None, default: bool = False) -> bool:
    if raw is None:
        return default
    return str(raw).strip().lower() in ("true", "1", "yes", "oui")


@router.post("", response_model=ReservationPublic, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    body: ReservationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Créer une nouvelle réservation (Utilisateur).
    - Vérifie la disponibilité des équipements aux dates données
    - Vérifie les contraintes (durée max, délai max, champs obligatoires)
    - Applique l'auto-approbation si configurée
    - Calcule la caution totale
    """
    if body.start_date > body.end_date:
        raise HTTPException(
            status_code=400, detail="La date de début doit être avant la date de fin."
        )

    # Check max duration
    result = await db.execute(
        select(Setting.value).where(Setting.key == "max_reservation_days")
    )
    max_days_str = result.scalar_one_or_none()
    max_days = int(max_days_str) if max_days_str else 14

    if (body.end_date - body.start_date).days > max_days:
        raise HTTPException(
            status_code=400, detail=f"La durée maximale est de {max_days} jours."
        )

    # Check max advance days
    result = await db.execute(
        select(Setting.value).where(Setting.key == "max_advance_days")
    )
    max_adv_str = result.scalar_one_or_none()
    max_adv = int(max_adv_str) if max_adv_str else 0

    if max_adv > 0:
        if (body.start_date - date.today()).days > max_adv:
            raise HTTPException(
                status_code=400,
                detail=f"Vous ne pouvez pas réserver plus de {max_adv} jours à l'avance.",
            )

    # Check require_phone setting
    phone_res = await db.execute(
        select(Setting.value).where(Setting.key == "require_phone")
    )
    require_phone = _as_bool(phone_res.scalar_one_or_none(), False)
    if require_phone and (not body.phone or not body.phone.strip()):
        raise HTTPException(
            status_code=400, detail="Le numéro de téléphone est obligatoire."
        )

    # Check require_comments setting
    comments_res = await db.execute(
        select(Setting.value).where(Setting.key == "require_comments")
    )
    require_comments = _as_bool(comments_res.scalar_one_or_none(), False)
    if require_comments and (not body.comments or not body.comments.strip()):
        raise HTTPException(
            status_code=400, detail="Le commentaire est obligatoire."
        )

    # Check blocking statuses from settings
    result = await db.execute(
        select(Setting.value).where(Setting.key == "blocking_equipment_statuses")
    )
    blocking_raw = result.scalar_one_or_none()
    try:
        blocking_statuses = (
            json.loads(blocking_raw)
            if blocking_raw
            else ["En réparation", "Hors service"]
        )
    except Exception:
        blocking_statuses = ["En réparation", "Hors service"]

    # 1. Fetch equipment to verify existence, non-archived status, and compute total deposit
    eq_result = await db.execute(
        select(Equipment).where(Equipment.id.in_(body.items))
    )
    equipment_list = eq_result.scalars().all()

    if len(equipment_list) != len(body.items):
        raise HTTPException(
            status_code=404, detail="Un ou plusieurs équipements sont introuvables."
        )

    total_deposit = 0.0
    for eq in equipment_list:
        if eq.is_archived:
            raise HTTPException(
                status_code=400,
                detail=f"L'équipement {eq.name} n'est plus disponible.",
            )
        if eq.status in blocking_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"L'équipement {eq.name} ({eq.status}) ne peut pas être réservé.",
            )

        if eq.deposit_amount:
            total_deposit += float(eq.deposit_amount)

    # 2. Verify availability
    overlap_res = await db.execute(
        select(ReservationItem.equipment_id)
        .join(Reservation)
        .where(
            and_(
                ReservationItem.equipment_id.in_(body.items),
                Reservation.status.in_(["active", "approved"]),
                Reservation.start_date <= body.end_date,
                Reservation.end_date >= body.start_date,
            )
        )
    )
    unavailable_ids = {row[0] for row in overlap_res}
    if unavailable_ids:
        unavailable_names = [
            eq.name for eq in equipment_list if eq.id in unavailable_ids
        ]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Les équipements suivants ne sont pas disponibles à ces dates : {', '.join(unavailable_names)}",
        )

    # Check auto_approve setting
    auto_res = await db.execute(
        select(Setting.value).where(Setting.key == "auto_approve_reservations")
    )
    auto_approve = _as_bool(auto_res.scalar_one_or_none(), False)
    initial_status = "approved" if auto_approve else "active"

    # 3. Create reservation
    res = Reservation(
        user_id=user.id,
        start_date=body.start_date,
        end_date=body.end_date,
        phone=body.phone,
        comments=body.comments,
        deposit_type=body.deposit_type,
        total_deposit=total_deposit,
        status=initial_status,
    )
    db.add(res)
    await db.flush()

    for eq_id in body.items:
        item = ReservationItem(reservation_id=res.id, equipment_id=eq_id)
        db.add(item)

    await log_audit(
        db=db,
        user=user,
        action="RESERVATION_CREATE",
        target_type="reservation",
        target_id=res.id,
        details={
            "start_date": str(body.start_date),
            "end_date": str(body.end_date),
            "items_count": len(body.items),
            "total_deposit": total_deposit,
            "auto_approved": auto_approve,
            "status": initial_status,
        },
        request=request,
    )
    await db.commit()

    final_res = await db.execute(
        select(Reservation)
        .options(
            selectinload(Reservation.items)
            .selectinload(ReservationItem.equipment)
            .selectinload(Equipment.category)
        )
        .where(Reservation.id == res.id)
    )
    return final_res.scalar_one()


@router.get("/me", response_model=list[ReservationPublic])
async def list_my_reservations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Lister les réservations de l'utilisateur connecté (sans les notes privées du mandat)."""
    result = await db.execute(
        select(Reservation)
        .options(
            selectinload(Reservation.items)
            .selectinload(ReservationItem.equipment)
            .selectinload(Equipment.category)
        )
        .where(Reservation.user_id == user.id)
        .order_by(Reservation.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/admin", response_model=list[ReservationDetail])
async def list_all_reservations(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Lister toutes les réservations avec les profils et les notes privées du mandat."""
    stmt = select(Reservation).options(
        selectinload(Reservation.user),
        selectinload(Reservation.returned_by_user),
        selectinload(Reservation.items)
        .selectinload(ReservationItem.equipment)
        .selectinload(Equipment.category),
    )
    if status:
        stmt = stmt.where(Reservation.status == status)

    result = await db.execute(stmt.order_by(Reservation.start_date.desc()))
    return list(result.scalars().all())


@router.patch("/{res_id}", response_model=ReservationDetail)
async def update_reservation(
    res_id: uuid.UUID,
    body: ReservationUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Mettre à jour une réservation (statut, dates, cautions, commentaire ou note privée du mandat)."""
    result = await db.execute(
        select(Reservation)
        .options(
            selectinload(Reservation.user),
            selectinload(Reservation.returned_by_user),
            selectinload(Reservation.items)
            .selectinload(ReservationItem.equipment)
            .selectinload(Equipment.category),
        )
        .where(Reservation.id == res_id)
    )
    res = result.scalar_one_or_none()

    if not res:
        raise HTTPException(status_code=404, detail="Réservation introuvable.")

    changes = {}

    if body.status is not None:
        valid_statuses = ["active", "approved", "returned", "cancelled"]
        if body.status not in valid_statuses:
            raise HTTPException(status_code=400, detail="Statut invalide.")

        old_status = res.status
        res.status = body.status
        changes["status"] = {"from": old_status, "to": body.status}

        if body.status == "cancelled" and body.cancel_comment:
            res.cancel_comment = body.cancel_comment
            changes["cancel_comment"] = body.cancel_comment

        if body.status == "returned":
            res.returned_by = user.id
            res.returned_at = datetime.now(timezone.utc)
            changes["returned_at"] = res.returned_at.isoformat()

    if body.start_date is not None:
        res.start_date = body.start_date
        changes["start_date"] = str(body.start_date)

    if body.end_date is not None:
        res.end_date = body.end_date
        changes["end_date"] = str(body.end_date)

    if res.start_date > res.end_date:
        raise HTTPException(
            status_code=400, detail="La date de début doit être avant la date de fin."
        )

    if body.phone is not None:
        res.phone = body.phone
        changes["phone"] = body.phone

    if body.deposit_type is not None:
        res.deposit_type = body.deposit_type
        changes["deposit_type"] = body.deposit_type

    if body.total_deposit is not None:
        res.total_deposit = body.total_deposit
        changes["total_deposit"] = body.total_deposit

    if body.comments is not None:
        res.comments = body.comments
        changes["comments"] = body.comments

    if body.staff_comment is not None:
        res.staff_comment = body.staff_comment
        changes["staff_comment"] = body.staff_comment

    await log_audit(
        db=db,
        user=user,
        action="RESERVATION_UPDATE",
        target_type="reservation",
        target_id=res.id,
        details=changes,
        request=request,
    )

    await db.commit()
    await db.refresh(res)
    return res
