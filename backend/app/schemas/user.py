"""
Schémas Pydantic — Utilisateurs (Admin).
"""

from pydantic import BaseModel

class UserUpdate(BaseModel):
    role: str | None = None
    is_blocked: bool | None = None
