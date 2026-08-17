"""
Schémas Pydantic — Settings.
"""

from pydantic import BaseModel, ConfigDict


class SettingUpdate(BaseModel):
    value: str


class SettingPublic(BaseModel):
    key: str
    value: str

    model_config = ConfigDict(from_attributes=True)


class PublicSettings(BaseModel):
    """Paramètres d'affichage exposés à tout utilisateur connecté."""

    max_reservation_days: int
    max_advance_days: int
    deposit_types: list[str]
    equipment_statuses: list[str]
    blocking_equipment_statuses: list[str] = ["En réparation", "Hors service"]
    auto_approve_reservations: bool = False
    require_phone: bool = False
    require_comments: bool = False
