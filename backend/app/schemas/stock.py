"""
Schémas Pydantic — Stock & Nourriture du club Cook'It.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class StockItemBase(BaseModel):
    name: str
    category: str | None = "Nourriture"
    quantity: str
    status: str = "Bon état"
    location: str | None = None
    comments: str | None = None
    expiration_date: date | None = None


class StockItemCreate(StockItemBase):
    pass


class StockItemUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    quantity: str | None = None
    status: str | None = None
    location: str | None = None
    comments: str | None = None
    expiration_date: date | None = None


class StockItemOut(StockItemBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
