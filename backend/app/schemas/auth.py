"""
Schémas Pydantic — Authentification.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class AuthRequest(BaseModel):
    """Requête d'inscription ou de connexion (email uniquement)."""

    email: EmailStr

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "+" in v.split("@")[0]:
            raise ValueError(
                "Les alias d'email (contenant '+') ne sont pas autorisés."
            )
        return v


class AuthResponse(BaseModel):
    """Réponse d'authentification avec token JWT."""

    access_token: str
    token_type: str = "bearer"
    user: "UserPublic"


class UserPublic(BaseModel):
    """Informations utilisateur visibles publiquement."""

    id: uuid.UUID
    email: str
    display_name: str
    role: str
    is_blocked: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# Resolve forward reference
AuthResponse.model_rebuild()
