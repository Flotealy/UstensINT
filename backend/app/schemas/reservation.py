"""
Schémas Pydantic — Réservations.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.auth import UserPublic
from app.schemas.equipment import EquipmentPublic


class ReservationItemBase(BaseModel):
    equipment_id: uuid.UUID


class ReservationItemCreate(ReservationItemBase):
    pass


class ReservationItemPublic(ReservationItemBase):
    id: uuid.UUID
    equipment: EquipmentPublic

    model_config = ConfigDict(from_attributes=True)


class ReservationBase(BaseModel):
    start_date: date
    end_date: date
    phone: str | None = None
    comments: str | None = None
    deposit_type: str | None = None


class ReservationCreate(ReservationBase):
    """Payload for creating a new reservation."""
    items: list[uuid.UUID] = Field(min_length=1, description="List of equipment IDs")


class ReservationUpdate(BaseModel):
    """Payload for updating a reservation by staff/moderator."""
    status: str | None = None
    cancel_comment: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    phone: str | None = None
    deposit_type: str | None = None
    total_deposit: float | None = None
    comments: str | None = None
    staff_comment: str | None = None


class ReservationPublic(ReservationBase):
    """Reservation details for the borrower (without private staff notes)."""
    id: uuid.UUID
    user_id: uuid.UUID
    status: str
    total_deposit: float
    cancel_comment: str | None = None
    returned_at: datetime | None = None
    created_at: datetime
    
    items: list[ReservationItemPublic]

    model_config = ConfigDict(from_attributes=True)


class ReservationDetail(ReservationPublic):
    """Reservation details for staff/moderators, including borrower profile and private staff comments."""
    user: UserPublic
    returned_by_user: UserPublic | None = None
    staff_comment: str | None = None
