import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email          = Column(String(255), unique=True, nullable=False, index=True)
    password_hash  = Column(String(255), nullable=False)
    ruflux_balance = Column(Integer, default=0, nullable=False)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inventory   = relationship("UserInventory",   back_populates="user", cascade="all, delete-orphan")
    world_state = relationship("UserWorldState",  back_populates="user", uselist=False, cascade="all, delete-orphan")
    purchases   = relationship("PurchaseHistory", back_populates="user", cascade="all, delete-orphan")


class UserInventory(Base):
    """One row per (user, item_key). Quantity tracks how many the user owns."""
    __tablename__ = "user_inventory"

    id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_kind = Column(String(50),  nullable=False)   # 'building' | 'wall' | 'unit'
    item_key  = Column(String(150), nullable=False)   # e.g. 'building_ty50_tx4' | 'unit_Soldier_01'
    item_name = Column(String(200), nullable=False)
    quantity  = Column(Integer, default=1, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="inventory")

    __table_args__ = (
        UniqueConstraint("user_id", "item_key", name="uq_user_item"),
    )


class UserWorldState(Base):
    """JSONB snapshot of the user's placed map objects and biome choice."""
    __tablename__ = "user_world_state"

    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    world_data = Column(JSONB, nullable=True)
    biome      = Column(String(50), default="normal")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="world_state")


class PurchaseHistory(Base):
    __tablename__ = "purchase_history"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_kind    = Column(String(50))
    item_name    = Column(String(200))
    item_key     = Column(String(150))
    price_rf     = Column(Integer)
    purchased_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="purchases")
