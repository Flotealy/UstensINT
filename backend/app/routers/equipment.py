"""
Router — Matériel (équipement).
"""

import os
import shutil
import uuid
from typing import Annotated

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_moderator
from app.models.category import Category
from app.models.equipment import Equipment
from app.models.user import User
from app.services.audit import log_audit
from app.schemas.equipment import (
    EquipmentArchive,
    EquipmentCreate,
    EquipmentDetail,
    EquipmentPublic,
    EquipmentUpdate,
)

router = APIRouter(prefix="/equipment", tags=["Equipment"])


@router.get("/public", response_model=list[EquipmentPublic])
async def list_equipment_public(
    search: str | None = None,
    category_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),  # Just needs to be logged in
):
    """Lister le catalogue (Utilisateur standard).
    Ne retourne que les équipements non archivés avec des informations restreintes.
    """
    stmt = select(Equipment).options(selectinload(Equipment.category)).where(Equipment.is_archived == False)
    
    if category_id:
        stmt = stmt.where(Equipment.category_id == category_id)
        
    if search:
        search_term = f"%{search}%"
        stmt = stmt.where(or_(
            Equipment.name.ilike(search_term),
            Equipment.label.ilike(search_term)
        ))
        
    result = await db.execute(stmt.order_by(Equipment.name))
    return list(result.scalars().all())


@router.get("/admin", response_model=list[EquipmentDetail])
async def list_equipment_admin(
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Lister le catalogue complet (Modérateur)."""
    stmt = select(Equipment).options(selectinload(Equipment.category))
    
    if not include_archived:
        stmt = stmt.where(Equipment.is_archived == False)
        
    result = await db.execute(stmt.order_by(Equipment.name))
    return list(result.scalars().all())


@router.post("", response_model=EquipmentDetail, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    body: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Créer un nouveau matériel (Modérateur)."""
    # Check label uniqueness
    existing = await db.execute(select(Equipment).where(Equipment.label == body.label))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une étiquette (label) identique existe déjà.",
        )
        
    # Check category
    if body.category_id:
        cat = await db.execute(select(Category).where(Category.id == body.category_id))
        if not cat.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Catégorie invalide.")
            
    equip = Equipment(**body.model_dump())
    db.add(equip)
    await db.commit()
    await db.refresh(equip)
    
    from app.services.audit import log_audit
    await log_audit(
        db=db,
        user=user,
        action="EQUIPMENT_CREATE",
        target_type="equipment",
        target_id=equip.id,
        details={"name": equip.name, "label": equip.label, "status": equip.status},
    )
    await db.commit()

    # Reload with category for response
    result = await db.execute(select(Equipment).options(selectinload(Equipment.category)).where(Equipment.id == equip.id))
    return result.scalar_one()


@router.patch("/{equipment_id}", response_model=EquipmentDetail)
async def update_equipment(
    equipment_id: uuid.UUID,
    body: EquipmentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Modifier un matériel (Mandat)."""
    result = await db.execute(select(Equipment).options(selectinload(Equipment.category)).where(Equipment.id == equipment_id))
    equip = result.scalar_one_or_none()
    
    if not equip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matériel introuvable.")
        
    if body.label is not None and body.label != equip.label:
        existing = await db.execute(select(Equipment).where(Equipment.label == body.label))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Une étiquette identique existe déjà.")
            
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(equip, key, value)
        
    from app.services.audit import log_audit
    await log_audit(
        db=db,
        user=user,
        action="EQUIPMENT_UPDATE",
        target_type="equipment",
        target_id=equip.id,
        details=update_data,
    )
    await db.commit()
    await db.refresh(equip)
    return equip


@router.post("/{equipment_id}/photo", response_model=EquipmentDetail)
async def upload_equipment_photo(
    equipment_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Uploader une photo pour un matériel (Mandat)."""
    result = await db.execute(select(Equipment).options(selectinload(Equipment.category)).where(Equipment.id == equipment_id))
    equip = result.scalar_one_or_none()
    
    if not equip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matériel introuvable.")
        
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le fichier doit être une image.")
        
    # Save file
    file_ext = os.path.splitext(file.filename or "")[1]
    new_filename = f"{equip.id}{file_ext}"
    file_path = os.path.join(settings.upload_dir, new_filename)
    
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
        
    equip.photo_upload = f"/uploads/{new_filename}"
    
    from app.services.audit import log_audit
    await log_audit(
        db=db,
        user=user,
        action="EQUIPMENT_PHOTO_UPLOAD",
        target_type="equipment",
        target_id=equip.id,
        details={"filename": file.filename},
    )
    await db.commit()
    await db.refresh(equip)
    return equip


@router.patch("/{equipment_id}/archive", response_model=EquipmentDetail)
async def archive_equipment(
    equipment_id: uuid.UUID,
    body: EquipmentArchive,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Suppression douce : archiver un matériel (Mandat)."""
    result = await db.execute(select(Equipment).options(selectinload(Equipment.category)).where(Equipment.id == equipment_id))
    equip = result.scalar_one_or_none()
    
    if not equip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Matériel introuvable.")
        
    equip.is_archived = True
    equip.archive_comment = body.archive_comment
    
    from app.services.audit import log_audit
    await log_audit(
        db=db,
        user=user,
        action="EQUIPMENT_ARCHIVE",
        target_type="equipment",
        target_id=equip.id,
        details={"name": equip.name, "comment": body.archive_comment},
    )
    await db.commit()
    await db.refresh(equip)
    return equip
