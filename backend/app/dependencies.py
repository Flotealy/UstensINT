"""
Dépendances FastAPI réutilisables (auth, DB session, permissions).
"""

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.utils.jwt import decode_access_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from JWT token."""
    token = credentials.credentials

    # Decode JWT
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from DB
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check blocked
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre compte a été bloqué. Contactez un administrateur.",
        )

    return user


async def require_moderator(user: User = Depends(get_current_user)) -> User:
    """Require the current user to have moderator or admin role."""
    if user.role not in ("moderator", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux modérateurs.",
        )
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    """Require the current user to have admin role."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs.",
        )
    return user


import time
from fastapi import Request

_RATE_LIMITS = {}

def rate_limiter(requests: int = 5, window: int = 60):
    """
    Limiteur de requêtes simple en mémoire (IP-based).
    """
    async def _rate_limit_dep(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        key = f"{client_ip}_{request.url.path}"
        
        if key in _RATE_LIMITS:
            _RATE_LIMITS[key] = [t for t in _RATE_LIMITS[key] if now - t < window]
        else:
            _RATE_LIMITS[key] = []
            
        if len(_RATE_LIMITS[key]) >= requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS, 
                detail="Trop de requêtes. Veuillez patienter."
            )
            
        _RATE_LIMITS[key].append(now)
        return True
        
    return _rate_limit_dep
