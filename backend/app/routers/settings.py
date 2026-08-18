"""
Router — Settings (Paramètres globaux).
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.setting import Setting
from app.models.user import User
from app.schemas.setting import PublicSettings, SettingPublic, SettingUpdate
from app.services.audit import log_audit

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=list[SettingPublic])
async def list_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Lister tous les paramètres (Admin)."""
    result = await db.execute(select(Setting).order_by(Setting.key))
    return list(result.scalars().all())


def _as_int(raw: str | None, default: int) -> int:
    try:
        return int(raw) if raw is not None else default
    except ValueError:
        return default


def _as_bool(raw: str | None, default: bool = False) -> bool:
    if raw is None:
        return default
    return str(raw).strip().lower() in ("true", "1", "yes", "oui")


def _as_list(raw: str | None, default: list[str]) -> list[str]:
    """Les listes sont stockées en JSON ; on tolère l'ancien format « a,b,c »."""
    if not raw:
        return default
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list) and parsed:
            return [str(item) for item in parsed]
    except (json.JSONDecodeError, TypeError):
        pass
    values = [part.strip() for part in raw.split(",") if part.strip()]
    return values or default


@router.get("/public", response_model=PublicSettings)
async def get_public_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Sous-ensemble des paramètres nécessaire à l'interface (utilisateur connecté).

    N'expose que des réglages d'affichage : durées maximales, listes de choix et contraintes de formulaire.
    Aucun secret (webhook, domaines autorisés) n'est renvoyé.
    """
    result = await db.execute(select(Setting))
    values = {setting.key: setting.value for setting in result.scalars().all()}

    return PublicSettings(
        max_reservation_days=_as_int(values.get("max_reservation_days"), 14),
        max_advance_days=_as_int(values.get("max_advance_days"), 0),
        deposit_types=_as_list(
            values.get("deposit_types"), ["Liquide", "Virement", "Chèque"]
        ),
        equipment_statuses=_as_list(
            values.get("equipment_statuses"),
            ["Neuf", "Bon état", "Usé", "En réparation", "Hors service"],
        ),
        blocking_equipment_statuses=_as_list(
            values.get("blocking_equipment_statuses"),
            ["En réparation", "Hors service"],
        ),
        auto_approve_reservations=_as_bool(
            values.get("auto_approve_reservations"), False
        ),
        require_phone=_as_bool(values.get("require_phone"), False),
        require_comments=_as_bool(values.get("require_comments"), False),
    )


@router.patch("/{key}", response_model=SettingPublic)
async def update_setting(
    key: str,
    body: SettingUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Mettre à jour un paramètre existant ou le créer s'il n'existe pas."""
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()

    if not setting:
        setting = Setting(key=key, value=body.value)
        db.add(setting)
    else:
        setting.value = body.value

    await log_audit(
        db=db,
        user=user,
        action="SETTING_UPDATE",
        target_type="setting",
        target_id=key,
        details={"key": key, "value": body.value},
        request=request,
    )

    await db.commit()
    await db.refresh(setting)
    return setting


class TestEmailRequest(BaseModel):
    target_email: str | None = None


@router.get("/smtp-status")
async def get_smtp_status(user: User = Depends(require_admin)):
    """Retourne l'état de la configuration SMTP."""
    from app.config import settings
    configured = bool(settings.smtp_host)
    return {
        "configured": configured,
        "smtp_host": settings.smtp_host,
        "smtp_port": settings.smtp_port,
        "smtp_from": settings.smtp_from or settings.smtp_user or (f"noreply@{settings.smtp_host}" if settings.smtp_host else ""),
        "smtp_user": settings.smtp_user,
        "smtp_tls": settings.smtp_tls,
    }


@router.post("/test-email")
async def send_test_email(
    body: TestEmailRequest | None = None,
    user: User = Depends(require_admin),
):
    """Envoie un email de test pour vérifier la chaîne SMTP."""
    from app.config import settings
    from app.utils.email import send_email

    target = (body.target_email.strip() if (body and body.target_email) else user.email)
    if not settings.smtp_host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le serveur SMTP n'est pas configuré (variable SMTP_HOST vide dans .env).",
        )

    subject = "Cook'It — Test de notification email réussi"
    text = (
        f"Bonjour {user.display_name},\n\n"
        f"Ceci est un email de test envoyé depuis le panneau d'administration de Cook'It.\n"
        f"Si vous recevez ce message, votre configuration SMTP et vos signatures DKIM/SPF fonctionnent parfaitement !\n\n"
        f"— L'équipe Cook'It Télécom SudParis"
    )
    html = f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:sans-serif;color:#0f172a;">
  <div style="max-width:480px;margin:24px auto;background:#fff;padding:28px;border-radius:12px;border:1px solid #e2e8f0;">
    <h1 style="color:#0f766e;font-size:20px;margin-top:0;">Cook'It — Test de notification</h1>
    <p style="color:#334155;font-size:14.5px;line-height:1.5;">
      Bonjour <strong>{user.display_name}</strong>,<br><br>
      Ceci est un <strong>email de test</strong> envoyé depuis le panneau d'administration.<br>
      Votre serveur SMTP (<code>{settings.smtp_host}</code>) est opérationnel et prêt à expédier les rappels et notifications de Cook'It !
    </p>
    <div style="background:#f8fafc;padding:12px;border-radius:8px;font-size:12.5px;color:#64748b;margin-top:16px;">
      Expéditeur : {settings.smtp_from or settings.smtp_user}<br>
      Destinataire : {target}
    </div>
  </div>
</body>
</html>"""

    try:
        await send_email(target, subject, html, text)
        return {
            "status": "success",
            "message": f"Email de test envoyé avec succès à {target} !",
            "target": target,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Échec de l'envoi de l'email de test : {str(e)}",
        )
