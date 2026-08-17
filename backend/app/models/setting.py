"""
Modèle ORM — Paramètres globaux (clé/valeur).
Tous les paramètres admin sont persistés ici et survivent aux redémarrages.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    key: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<Setting {self.key}={self.value[:50]}>"
