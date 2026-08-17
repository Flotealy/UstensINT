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
