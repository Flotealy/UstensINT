"""
Schémas Pydantic — Matériel (équipement).
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.category import CategoryPublic


class EquipmentBase(BaseModel):
    name: str
    label: str
    category_id: uuid.UUID | None = None
    location: str | None = None
    purchase_cost: float | None = None
    deposit_amount: float | None = None
    status: str = "Bon état"
    photo_url: str | None = None
    comments: str | None = None


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    name: str | None = None
    label: str | None = None
    category_id: uuid.UUID | None = None
    location: str | None = None
    purchase_cost: float | None = None
    deposit_amount: float | None = None
    status: str | None = None
    photo_url: str | None = None
    comments: str | None = None


class EquipmentArchive(BaseModel):
    archive_comment: str


# Pour les utilisateurs lambda : informations restreintes
class EquipmentPublic(BaseModel):
    id: uuid.UUID
    name: str
    label: str
    category: CategoryPublic | None = None
    deposit_amount: float | None = None
    status: str
    photo_url: str | None = None
    photo_upload: str | None = None
    
    # Note: On the public side we only show non-archived equipment.
    # But we might need the flag in UI to know it's not reservable, 
    # except that archived = hidden completely, and "indisponible" is handled via reservations.
    
    model_config = ConfigDict(from_attributes=True)


# Pour les modérateurs/admins : toutes les informations
class EquipmentDetail(EquipmentPublic):
    location: str | None = None
    purchase_cost: float | None = None
    comments: str | None = None
    is_archived: bool
    archive_comment: str | None = None
    created_at: datetime
