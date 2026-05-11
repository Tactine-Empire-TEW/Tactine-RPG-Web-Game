from __future__ import annotations
from uuid import UUID
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, EmailStr


# ── Auth ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: UUID
    email: str
    ruflux_balance: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Economy ───────────────────────────────────────────────────────────

class BalanceUpdate(BaseModel):
    ruflux_balance: int


# ── Inventory ─────────────────────────────────────────────────────────

class InventoryItemOut(BaseModel):
    id: UUID
    item_kind: str
    item_key: str
    item_name: str
    quantity: int
    updated_at: datetime

    class Config:
        from_attributes = True

class PurchaseRequest(BaseModel):
    item_kind: str
    item_key: str
    item_name: str
    price_rf: int

class InventoryQuantityUpdate(BaseModel):
    quantity: int


# ── World ─────────────────────────────────────────────────────────────

class WorldStateIn(BaseModel):
    world_data: Any
    biome: str = "normal"

class WorldStateOut(BaseModel):
    world_data: Optional[Any] = None
    biome: str = "normal"
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
