"""
Router — Catégories de matériel.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_moderator
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryPublic, CategoryUpdate
from app.services.audit import log_audit

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryPublic])
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Lister toutes les catégories (Public)."""
    result = await db.execute(select(Category).order_by(Category.name))
    return list(result.scalars().all())


@router.post("", response_model=CategoryPublic, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Créer une catégorie (Modérateur)."""
    # Verify name uniqueness
    existing = await db.execute(select(Category).where(Category.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Une catégorie avec ce nom existe déjà.",
        )
        
    cat = Category(**body.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)

    from app.services.audit import log_audit
    await log_audit(
        db=db,
        user=user,
        action="CATEGORY_CREATE",
        target_type="category",
        target_id=cat.id,
        details={"name": cat.name},
    )
    await db.commit()
    return cat


@router.patch("/{category_id}", response_model=CategoryPublic)
async def update_category(
    category_id: uuid.UUID,
    body: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Modifier une catégorie (Mandat)."""
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catégorie introuvable.")
        
    if body.name is not None and body.name != cat.name:
        existing = await db.execute(select(Category).where(Category.name == body.name))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Une catégorie avec ce nom existe déjà.",
            )
            
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(cat, key, value)
        
    from app.services.audit import log_audit
    await log_audit(
        db=db,
        user=user,
        action="CATEGORY_UPDATE",
        target_type="category",
        target_id=cat.id,
        details=update_data,
    )
    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_moderator),
):
    """Supprimer une catégorie (Mandat)."""
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catégorie introuvable.")
        
    cat_name = cat.name
    await db.delete(cat)
    
    from app.services.audit import log_audit
    await log_audit(
        db=db,
        user=user,
        action="CATEGORY_DELETE",
        target_type="category",
        target_id=category_id,
        details={"name": cat_name},
    )
    await db.commit()
    return None
