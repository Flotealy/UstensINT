"""
Schémas Pydantic — Journal d'Audit.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None = None
    user_email: str | None = None
    user_name: str | None = None
    action: str
    target_type: str
    target_id: str | None = None
    details: str | None = None
    ip_address: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
