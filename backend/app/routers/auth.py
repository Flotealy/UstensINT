"""
Router — Authentification (inscription / connexion).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, rate_limiter
from app.models.user import User
from app.schemas.auth import AuthRequest, AuthResponse, UserPublic
from app.utils.email import deduce_display_name, validate_email_domain
from app.utils.jwt import create_access_token
from app.services.audit import log_audit

router = APIRouter(prefix="/auth", tags=["Authentification"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limiter(requests=5, window=60))])
async def register(body: AuthRequest, db: AsyncSession = Depends(get_db)):
    """Créer un nouveau compte utilisateur.

    - Valide le domaine email
    - Refuse les alias '+'
    - Déduit le nom depuis l'email (prenom.nom → Prénom Nom)
    - Retourne un token JWT (7 jours)
    """
    email = body.email

    # Check domain
    if not await validate_email_domain(email, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce domaine email n'est pas autorisé.",
        )

    # Check if user already exists
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte avec cet email existe déjà.",
        )

    # Create user
    display_name = deduce_display_name(email)
    user = User(email=email, display_name=display_name, role="user")
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Generate JWT
    token = create_access_token(user.id, user.role)

    await log_audit(
        db=db,
        user=user,
        action="AUTH_REGISTER",
        target_type="user",
        target_id=user.id,
        details={"email": user.email, "display_name": user.display_name},
    )
    await db.commit()

    return AuthResponse(
        access_token=token,
        user=UserPublic.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse, dependencies=[Depends(rate_limiter(requests=10, window=60))])
async def login(body: AuthRequest, db: AsyncSession = Depends(get_db)):
    """Se connecter avec un email existant.

    - Vérifie que le compte existe
    - Vérifie que le compte n'est pas bloqué
    - Retourne un token JWT (7 jours)
    """
    email = body.email

    # Find user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun compte trouvé avec cet email.",
        )

    # Check blocked
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre compte a été bloqué. Contactez un administrateur.",
        )

    # Generate JWT
    token = create_access_token(user.id, user.role)

    await log_audit(
        db=db,
        user=user,
        action="AUTH_LOGIN",
        target_type="user",
        target_id=user.id,
        details={"email": user.email},
    )
    await db.commit()

    return AuthResponse(
        access_token=token,
        user=UserPublic.model_validate(user),
    )


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: User = Depends(get_current_user)):
    """Récupérer les informations de l'utilisateur connecté."""
    return UserPublic.model_validate(current_user)
