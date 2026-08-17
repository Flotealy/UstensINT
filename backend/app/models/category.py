"""
Modèle ORM — Catégories de matériel.
"""

import uuid

from sqlalchemy import String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    equipment: Mapped[list["Equipment"]] = relationship(
        "Equipment", back_populates="category"
    )

    def __repr__(self) -> str:
        return f"<Category {self.name}>"
