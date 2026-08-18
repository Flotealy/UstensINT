"""
Schémas Pydantic — Authentification et validation de code OTP.
"""

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class SendCodeRequest(BaseModel):
    """Requête de demande d'envoi de code OTP par email."""

    email: EmailStr

    @field_validator("email")
    @classmethod
    def validate_email_no_plus(cls, v: str) -> str:
        v = v.strip().lower()
        if "+" in v:
            raise ValueError(
                "Les alias d'email (contenant le caractère '+') ne sont pas autorisés."
            )
        return v


class SendCodeResponse(BaseModel):
    """Réponse suite à l'envoi d'un code OTP."""

    message: str
    email: str
    expires_in_seconds: int = 600
    cooldown_seconds: int = 60


class VerifyCodeRequest(BaseModel):
    """Requête de validation de code OTP pour connexion / inscription."""

    email: EmailStr
    code: str

    @field_validator("email")
    @classmethod
    def validate_email_no_plus(cls, v: str) -> str:
        v = v.strip().lower()
        if "+" in v:
            raise ValueError(
                "Les alias d'email (contenant le caractère '+') ne sont pas autorisés."
            )
        return v

    @field_validator("code")
    @classmethod
    def validate_code_format(cls, v: str) -> str:
        clean = v.strip().upper()
        if len(clean) != 6 or not re.match(r"^[A-Z0-9]{6}$", clean):
            raise ValueError(
                "Le code doit comporter exactement 6 caractères alphanumériques (lettres ou chiffres)."
            )
        return clean


class AuthRequest(BaseModel):
    """Requête d'authentification directe (rétrocompatibilité)."""

    email: EmailStr

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "+" in v:
            raise ValueError(
                "Les alias d'email (contenant '+') ne sont pas autorisés."
            )
        return v


class UserPublic(BaseModel):
    """Informations utilisateur visibles publiquement."""

    id: uuid.UUID
    email: str
    display_name: str
    role: str
    is_blocked: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Réponse d'authentification avec token JWT."""

    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# Resolve forward reference
AuthResponse.model_rebuild()
