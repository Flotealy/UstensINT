"""
Schémas Pydantic — Catégories de matériel.
"""

import uuid

from pydantic import BaseModel, ConfigDict


class CategoryBase(BaseModel):
    name: str
    description: str | None = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(CategoryBase):
    name: str | None = None


class CategoryPublic(CategoryBase):
    id: uuid.UUID
    
    model_config = ConfigDict(from_attributes=True)
