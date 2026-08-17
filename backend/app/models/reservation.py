"""
Modèles ORM — Réservations et lignes de réservation.
"""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active"
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_deposit: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, default=0
    )
    deposit_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    staff_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancel_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    returned_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    returned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="reservations",
        foreign_keys=[user_id],
    )
    returned_by_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[returned_by],
    )
    items: Mapped[list["ReservationItem"]] = relationship(
        "ReservationItem", back_populates="reservation", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Reservation {self.id} ({self.status})>"


class ReservationItem(Base):
    __tablename__ = "reservation_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reservations.id", ondelete="CASCADE"),
        nullable=False,
    )
    equipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("equipment.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    reservation: Mapped["Reservation"] = relationship(
        "Reservation", back_populates="items"
    )
    equipment: Mapped["Equipment"] = relationship(
        "Equipment", back_populates="reservation_items"
    )

    def __repr__(self) -> str:
        return f"<ReservationItem reservation={self.reservation_id} equipment={self.equipment_id}>"
