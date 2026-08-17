"""
Modèle ORM — Stock & Nourriture du club (Consommables & Matériel interne Cook'It).
Accessible uniquement aux utilisateurs avec le rôle Mandat ou Administrateur.
"""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ClubStock(Base):
    __tablename__ = "club_stock"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True, default="Nourriture")
    quantity: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(100), nullable=False, default="Bon état")
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    expiration_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<ClubStock {self.name} ({self.quantity}) - {self.status}>"
