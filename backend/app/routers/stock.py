"""
Router — Stock & Nourriture du club (Cook'It).
Accessible uniquement aux utilisateurs avec le rôle Mandat (moderator) ou Administrateur.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_moderator
from app.models.stock import ClubStock
from app.models.user import User
from app.schemas.stock import StockItemCreate, StockItemOut, StockItemUpdate
from app.services.audit import log_audit
from app.services.notify import (
    STOCK_ALERT_STATUSES,
    build_notification,
    send_notification,
)

router = APIRouter(prefix="/stock", tags=["Stock & Consommables"])


async def _queue_stock_alert(
    db: AsyncSession, background_tasks: BackgroundTasks, item: ClubStock
) -> None:
    """Prévenir le mandat qu'un consommable demande une action (réappro / péremption)."""
    notification = await build_notification(
        db,
        "stock_alert",
        title=f"Stock à surveiller — {item.name}",
        summary=(
            f"« {item.name} » vient de passer au statut « {item.status} ». "
            "Pensez à réapprovisionner ou à retirer l'article de la réserve."
        ),
        fields=[
            ("Article", item.name),
            ("Statut", item.status),
            ("Quantité", item.quantity),
            ("Catégorie", item.category or "—"),
            ("Emplacement", item.location or "—"),
        ],
        include_staff=True,
    )
    if notification:
        background_tasks.add_task(send_notification, notification)


@router.get("", response_model=list[StockItemOut])
async def list_stock(
    search: str | None = None,
    category: str | None = None,
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Lister le stock et la nourriture du club."""
    stmt = select(ClubStock)

    if category:
        stmt = stmt.where(ClubStock.category == category)

    if status_filter:
        stmt = stmt.where(ClubStock.status == status_filter)

    if search:
        search_term = f"%{search}%"
        stmt = stmt.where(
            or_(
                ClubStock.name.ilike(search_term),
                ClubStock.location.ilike(search_term),
                ClubStock.comments.ilike(search_term),
            )
        )

    result = await db.execute(stmt.order_by(ClubStock.name.asc()))
    return list(result.scalars().all())


@router.post("", response_model=StockItemOut, status_code=status.HTTP_201_CREATED)
async def create_stock_item(
    body: StockItemCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Ajouter un élément au stock ou à la réserve de nourriture."""
    item = ClubStock(**body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)

    await log_audit(
        db=db,
        user=user,
        action="STOCK_CREATE",
        target_type="stock",
        target_id=item.id,
        details={"name": item.name, "quantity": item.quantity, "status": item.status},
        request=request,
    )
    await db.commit()

    return item


@router.patch("/{item_id}", response_model=StockItemOut)
async def update_stock_item(
    item_id: uuid.UUID,
    body: StockItemUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Modifier un élément du stock."""
    result = await db.execute(select(ClubStock).where(ClubStock.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Élément de stock introuvable."
        )

    patch_data = body.model_dump(exclude_unset=True)
    for field, val in patch_data.items():
        setattr(item, field, val)

    await db.commit()
    await db.refresh(item)

    await log_audit(
        db=db,
        user=user,
        action="STOCK_UPDATE",
        target_type="stock",
        target_id=item.id,
        details=patch_data,
        request=request,
    )
    await db.commit()

    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stock_item(
    item_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Supprimer un élément du stock."""
    result = await db.execute(select(ClubStock).where(ClubStock.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Élément de stock introuvable."
        )

    item_name = item.name
    await db.delete(item)
    await db.commit()

    await log_audit(
        db=db,
        user=user,
        action="STOCK_DELETE",
        target_type="stock",
        target_id=item_id,
        details={"name": item_name},
        request=request,
    )
    await db.commit()
