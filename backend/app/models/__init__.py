"""
Modèles ORM — Import centralisé.
Tous les modèles doivent être importés ici pour que SQLAlchemy les enregistre
dans Base.metadata et que create_all() fonctionne correctement.
"""

from app.models.user import User
from app.models.category import Category
from app.models.equipment import Equipment
from app.models.reservation import Reservation, ReservationItem
from app.models.setting import Setting
from app.models.audit_log import AuditLog
from app.models.stock import ClubStock
from app.models.auth_code import AuthCode

__all__ = [
    "User",
    "Category",
    "Equipment",
    "Reservation",
    "ReservationItem",
    "Setting",
    "AuditLog",
    "ClubStock",
    "AuthCode",
]
