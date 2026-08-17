"""
Utilitaires JWT — Création et vérification de tokens.
"""

import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import settings


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    """Create a JWT access token for the given user."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.jwt_expiration_days)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token.

    Returns the payload dict with 'sub' (user_id) and 'role'.
    Raises JWTError if the token is invalid or expired.
    """
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
