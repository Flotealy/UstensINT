"""
Modèle ORM — Journal d'Audit (Audit Logs).
Conforme RGPD : ne stocke que les métadonnées nécessaires à la traçabilité.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    target_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        index=True,
    )

    # Relationships
    user: Mapped["User | None"] = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} on {self.target_type}:{self.target_id} by {self.user_email}>"
