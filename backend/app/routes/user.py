from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.database import get_db
from app import models, schemas
from app.auth_utils import get_current_user

router = APIRouter()


# ── Balance ───────────────────────────────────────────────────────────

@router.get("/balance")
def get_balance(user: models.User = Depends(get_current_user)):
    return {"ruflux_balance": user.ruflux_balance}


@router.put("/balance")
def set_balance(body: schemas.BalanceUpdate, db: Session = Depends(get_db),
                user: models.User = Depends(get_current_user)):
    if body.ruflux_balance < 0:
        raise HTTPException(status_code=400, detail="Balance cannot be negative")
    user.ruflux_balance = body.ruflux_balance
    db.commit()
    return {"ruflux_balance": user.ruflux_balance}


# ── Inventory ─────────────────────────────────────────────────────────

@router.get("/inventory", response_model=list[schemas.InventoryItemOut])
def get_inventory(user: models.User = Depends(get_current_user)):
    return user.inventory


@router.post("/inventory/purchase", response_model=schemas.InventoryItemOut, status_code=201)
def purchase_item(body: schemas.PurchaseRequest, db: Session = Depends(get_db),
                  user: models.User = Depends(get_current_user)):
    if user.ruflux_balance < body.price_rf:
        raise HTTPException(status_code=402, detail="Insufficient Ruflux balance")

    # Deduct balance
    user.ruflux_balance -= body.price_rf

    # Upsert inventory row (increment quantity if already owned)
    existing = (
        db.query(models.UserInventory)
        .filter_by(user_id=user.id, item_key=body.item_key)
        .first()
    )
    if existing:
        existing.quantity += 1
        item = existing
    else:
        item = models.UserInventory(
            user_id=user.id,
            item_kind=body.item_kind,
            item_key=body.item_key,
            item_name=body.item_name,
            quantity=1,
        )
        db.add(item)

    # Log purchase
    db.add(models.PurchaseHistory(
        user_id=user.id,
        item_kind=body.item_kind,
        item_name=body.item_name,
        item_key=body.item_key,
        price_rf=body.price_rf,
    ))

    db.commit()
    db.refresh(item)
    return item


@router.delete("/inventory/{item_key}")
def consume_item(item_key: str, db: Session = Depends(get_db),
                 user: models.User = Depends(get_current_user)):
    """Decrement quantity by 1 (called when placing an item on the map)."""
    item = (
        db.query(models.UserInventory)
        .filter_by(user_id=user.id, item_key=item_key)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not in inventory")
    if item.quantity <= 0:
        raise HTTPException(status_code=400, detail="No remaining quantity")
    item.quantity -= 1
    db.commit()
    return {"item_key": item_key, "quantity": item.quantity}
