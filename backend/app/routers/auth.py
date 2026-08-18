"""
Router — Authentification (OTP email alphanumérique sécurisé).
"""

import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, rate_limiter
from app.models.auth_code import AuthCode
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    SendCodeRequest,
    SendCodeResponse,
    UserPublic,
    VerifyCodeRequest,
)
from app.services.audit import log_audit
from app.utils.email import deduce_display_name, send_otp_email, validate_email_domain
from app.utils.jwt import create_access_token

router = APIRouter(prefix="/auth", tags=["Authentification"])

# Durée de validité du code en minutes
OTP_EXPIRATION_MINUTES = 10
# Cooldown anti-spam entre deux demandes de code pour une même adresse (en secondes)
OTP_COOLDOWN_SECONDS = 60
# Nombre d'essais maximum par code
OTP_MAX_ATTEMPTS = 5


def _hash_code(code: str) -> str:
    """Hash le code en SHA-256 avant stockage en base."""
    return hashlib.sha256(code.strip().upper().encode("utf-8")).hexdigest()


def _generate_code(length: int = 6) -> str:
    """Génère un code aléatoire alphanumérique sécurisé (lettres majuscules + chiffres)."""
    charset = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(charset) for _ in range(length))


@router.post(
    "/send-code",
    response_model=SendCodeResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(rate_limiter(requests=6, window=60))],
)
async def send_code(body: SendCodeRequest, db: AsyncSession = Depends(get_db)):
    """Génère et envoie un code OTP alphanumérique à 6 caractères par email.

    - Rejette les alias avec '+'
    - Valide le domaine autorisé
    - Empêche l'envoi si le compte est bloqué
    - Impose un délai d'attente (cooldown 60s) entre deux demandes
    - Invalide les anciens codes non utilisés pour cet email
    - Envoie le code par email via SMTP (valide 10 minutes)
    """
    email = body.email
    now = datetime.now(timezone.utc)

    # 1. Vérification du domaine autorisé
    if not await validate_email_domain(email, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce domaine email n'est pas autorisé pour l'inscription.",
        )

    # 2. Vérification si l'utilisateur existe et est bloqué
    user_query = await db.execute(select(User).where(User.email == email))
    user = user_query.scalar_one_or_none()
    if user and user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre compte a été bloqué. Contactez un administrateur.",
        )

    # 3. Cooldown anti-spam : vérifier le dernier code envoyé
    recent_code_query = await db.execute(
        select(AuthCode)
        .where(AuthCode.email == email, AuthCode.is_used == False)
        .order_by(AuthCode.created_at.desc())
    )
    latest_code = recent_code_query.scalars().first()

    if latest_code:
        elapsed = (now - latest_code.created_at).total_seconds()
        if elapsed < OTP_COOLDOWN_SECONDS:
            remaining = int(OTP_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Veuillez patienter encore {max(1, remaining)} seconde(s) avant de demander un nouveau code.",
            )

    # 4. Invalider tous les anciens codes pour cette adresse (un seul code actif à la fois)
    await db.execute(
        update(AuthCode)
        .where(AuthCode.email == email, AuthCode.is_used == False)
        .values(is_used=True)
    )

    # 5. Générer le nouveau code OTP alphanumérique (6 caractères)
    raw_code = _generate_code(6)
    code_hash = _hash_code(raw_code)
    expires_at = now + timedelta(minutes=OTP_EXPIRATION_MINUTES)

    new_auth_code = AuthCode(
        email=email,
        code_hash=code_hash,
        attempts=0,
        max_attempts=OTP_MAX_ATTEMPTS,
        is_used=False,
        expires_at=expires_at,
        created_at=now,
    )
    db.add(new_auth_code)
    await db.commit()

    # 6. Envoi de l'email via SMTP
    try:
        await send_otp_email(email, raw_code, expires_in_minutes=OTP_EXPIRATION_MINUTES)
    except Exception as e:
        # En cas d'échec d'envoi SMTP (ex: serveur mail inaccessible en local)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Impossible d'envoyer l'email d'authentification. Vérifiez la configuration SMTP.",
        )

    return SendCodeResponse(
        message="Un code de connexion à 6 caractères vous a été envoyé par email.",
        email=email,
        expires_in_seconds=OTP_EXPIRATION_MINUTES * 60,
        cooldown_seconds=OTP_COOLDOWN_SECONDS,
    )


@router.post(
    "/verify-code",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(rate_limiter(requests=15, window=60))],
)
async def verify_code(body: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    """Valide le code OTP saisi par l'utilisateur et délivre un token JWT.

    - Vérifie la validité temporelle (10 minutes)
    - Bloque les attaques bruteforce (max 5 tentatives par code)
    - Crée le compte automatiquement à la première connexion si absent
    - Retourne un token JWT de session (7 jours)
    """
    email = body.email
    submitted_code = body.code
    now = datetime.now(timezone.utc)

    # 1. Récupérer le code actif non utilisé le plus récent
    query = await db.execute(
        select(AuthCode)
        .where(AuthCode.email == email, AuthCode.is_used == False)
        .order_by(AuthCode.created_at.desc())
    )
    auth_code = query.scalars().first()

    if not auth_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun code de connexion actif trouvé. Veuillez en demander un nouveau.",
        )

    # 2. Vérifier l'expiration
    if now > auth_code.expires_at:
        auth_code.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce code a expiré (validité 10 min). Veuillez en demander un nouveau.",
        )

    # 3. Vérifier le nombre d'essais précédents
    if auth_code.attempts >= auth_code.max_attempts:
        auth_code.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nombre maximum de tentatives dépassé pour ce code. Veuillez en redemander un.",
        )

    # 4. Comparer le hash (timing-safe)
    submitted_hash = _hash_code(submitted_code)
    if not secrets.compare_digest(auth_code.code_hash, submitted_hash):
        auth_code.attempts += 1
        remaining = auth_code.max_attempts - auth_code.attempts
        if auth_code.attempts >= auth_code.max_attempts:
            auth_code.is_used = True

        await db.commit()

        if remaining > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Code incorrect. Il vous reste {remaining} tentative(s).",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Code incorrect. Nombre maximal de tentatives dépassé. Veuillez redemander un code.",
            )

    # 5. Le code est correct : le marquer comme consommé immédiatement
    auth_code.is_used = True

    # 6. Récupérer ou créer l'utilisateur
    user_query = await db.execute(select(User).where(User.email == email))
    user = user_query.scalar_one_or_none()

    if not user:
        # Première connexion : création automatique du compte
        display_name = deduce_display_name(email)
        user = User(email=email, display_name=display_name, role="user")
        db.add(user)
        await db.flush()
        await db.refresh(user)

        await log_audit(
            db=db,
            user=user,
            action="AUTH_REGISTER",
            target_type="user",
            target_id=user.id,
            details={"email": user.email, "display_name": user.display_name, "auth_method": "otp_email"},
        )
    else:
        if user.is_blocked:
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Votre compte a été bloqué. Contactez un administrateur.",
            )

        await log_audit(
            db=db,
            user=user,
            action="AUTH_LOGIN",
            target_type="user",
            target_id=user.id,
            details={"email": user.email, "auth_method": "otp_email"},
        )

    await db.commit()

    # 7. Générer le JWT
    token = create_access_token(user.id, user.role)

    return AuthResponse(
        access_token=token,
        user=UserPublic.model_validate(user),
    )


@router.get("/me", response_model=UserPublic)
async def me(current_user: User = Depends(get_current_user)):
    """Retourne les informations du profil utilisateur connecté."""
    return current_user
