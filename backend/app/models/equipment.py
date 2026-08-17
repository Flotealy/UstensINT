"""
Modèle ORM — Matériel (équipement).
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    label: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    purchase_cost: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    deposit_amount: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(100), nullable=False, default="Bon état", server_default="Bon état"
    )
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    photo_upload: Mapped[str | None] = mapped_column(String(500), nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    archive_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )

    # Relationships
    category: Mapped["Category | None"] = relationship(
        "Category", back_populates="equipment"
    )
    reservation_items: Mapped[list["ReservationItem"]] = relationship(
        "ReservationItem", back_populates="equipment"
    )

    def __repr__(self) -> str:
        return f"<Equipment {self.label}: {self.name}>"
