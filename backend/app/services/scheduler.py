"""
Tâche de fond — rappels de restitution et alertes de retard.

Un balayage régulier suffit : chaque réservation est horodatée après envoi
(`reminder_sent_at`, `overdue_notified_at`) pour ne jamais notifier deux fois.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import async_session
from app.models.equipment import Equipment
from app.models.reservation import Reservation, ReservationItem
from app.models.setting import Setting
from app.services.notify import build_notification, send_notification

logger = logging.getLogger("uvicorn.error")

SCAN_INTERVAL_SECONDS = 1800  # 30 minutes
STARTUP_DELAY_SECONDS = 60
OPEN_STATUSES = ("active", "approved")


def _deadline(end_date: date) -> datetime:
    """Fin de journée du dernier jour de prêt, en UTC."""
    return datetime.combine(end_date, time(23, 59), tzinfo=timezone.utc)


def _period(res: Reservation) -> str:
    return f"du {res.start_date.strftime('%d/%m/%Y')} au {res.end_date.strftime('%d/%m/%Y')}"


def _equipment_names(res: Reservation) -> str:
    return ", ".join(item.equipment.name for item in res.items) or "—"


async def _reminder_hours(db: AsyncSession) -> int:
    result = await db.execute(
        select(Setting.value).where(Setting.key == "email_reminder_hours_before")
    )
    raw = result.scalar_one_or_none()
    try:
        return max(1, int(raw)) if raw else 24
    except (TypeError, ValueError):
        return 24


def _open_reservations_stmt():
    return (
        select(Reservation)
        .options(
            selectinload(Reservation.user),
            selectinload(Reservation.items)
            .selectinload(ReservationItem.equipment)
            .selectinload(Equipment.category),
        )
        .where(Reservation.status.in_(OPEN_STATUSES))
    )


async def _process_reminders(db: AsyncSession, now: datetime) -> None:
    hours = await _reminder_hours(db)
    window_end = now + timedelta(hours=hours)

    result = await db.execute(
        _open_reservations_stmt().where(
            Reservation.reminder_sent_at.is_(None),
            Reservation.end_date >= now.date(),
            Reservation.end_date <= window_end.date(),
        )
    )

    for res in result.scalars().all():
        deadline = _deadline(res.end_date)
        if deadline <= now or deadline > window_end:
            continue

        notification = await build_notification(
            db,
            "reminder",
            title="Restitution à prévoir",
            summary=(
                f"Le matériel réservé {_period(res)} est à rendre le "
                f"{res.end_date.strftime('%d/%m/%Y')} au local Cook'It, "
                "propre et complet."
            ),
            fields=[
                ("Emprunteur", res.user.display_name if res.user else "—"),
                ("Retour prévu", res.end_date.strftime("%d/%m/%Y")),
                ("Matériel", _equipment_names(res)),
            ],
            email_to=[res.user.email] if res.user else [],
        )
        if notification:
            await send_notification(notification)

        res.reminder_sent_at = now

    await db.commit()


async def _process_overdue(db: AsyncSession, now: datetime) -> None:
    result = await db.execute(
        _open_reservations_stmt().where(
            Reservation.overdue_notified_at.is_(None),
            Reservation.end_date < now.date(),
        )
    )

    for res in result.scalars().all():
        late_days = (now.date() - res.end_date).days

        notification = await build_notification(
            db,
            "overdue",
            title="Matériel non restitué",
            summary=(
                f"La réservation {_period(res)} est en retard de {late_days} jour(s). "
                "Le matériel doit être rendu au plus vite pour libérer la caution."
            ),
            fields=[
                ("Emprunteur", res.user.display_name if res.user else "—"),
                ("Retour prévu", res.end_date.strftime("%d/%m/%Y")),
                ("Retard", f"{late_days} jour(s)"),
                ("Matériel", _equipment_names(res)),
                ("Caution", f"{float(res.total_deposit or 0):.2f} €"),
            ],
            email_to=[res.user.email] if res.user else [],
            include_staff=True,
        )
        if notification:
            await send_notification(notification)

        res.overdue_notified_at = now

    await db.commit()


async def scan_once() -> None:
    """Un passage complet : rappels puis retards."""
    now = datetime.now(timezone.utc)
    async with async_session() as db:
        await _process_reminders(db, now)
        await _process_overdue(db, now)


async def run_scheduler() -> None:
    """Boucle de fond démarrée au lancement de l'application."""
    await asyncio.sleep(STARTUP_DELAY_SECONDS)
    while True:
        try:
            await scan_once()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # une erreur ne doit jamais tuer la boucle
            logger.error("[SCHEDULER] Balayage des rappels échoué : %s", exc)
        await asyncio.sleep(SCAN_INTERVAL_SECONDS)
