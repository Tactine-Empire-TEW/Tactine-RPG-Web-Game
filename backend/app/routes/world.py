from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth_utils import get_current_user

router = APIRouter()


@router.get("/state", response_model=schemas.WorldStateOut)
def get_world_state(user: models.User = Depends(get_current_user)):
    if not user.world_state:
        return schemas.WorldStateOut()
    return user.world_state


@router.put("/state", response_model=schemas.WorldStateOut)
def save_world_state(body: schemas.WorldStateIn, db: Session = Depends(get_db),
                     user: models.User = Depends(get_current_user)):
    if user.world_state:
        user.world_state.world_data = body.world_data
        user.world_state.biome      = body.biome
    else:
        db.add(models.UserWorldState(
            user_id=user.id,
            world_data=body.world_data,
            biome=body.biome,
        ))
    db.commit()
    db.refresh(user)
    return user.world_state
