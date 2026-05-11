from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth_utils import (
    hash_password, verify_password, create_access_token,
    get_current_user, set_auth_cookie, clear_auth_cookie,
)

router = APIRouter()


@router.post("/register", status_code=201)
def register(request: Request, body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=body.email,
        password_hash=hash_password(body.password),
        ruflux_balance=0,
    )
    db.add(user)
    db.flush()
    db.add(models.UserWorldState(user_id=user.id, world_data=None, biome="normal"))
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    is_local = request.client.host in ("127.0.0.1", "::1")
    response = JSONResponse({"message": "registered"}, status_code=201)
    set_auth_cookie(response, token, is_local=is_local)
    return response


@router.post("/login")
def login(request: Request, body: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(user.id))
    is_local = request.client.host in ("127.0.0.1", "::1")
    response = JSONResponse({"message": "logged in"})
    set_auth_cookie(response, token, is_local=is_local)
    return response


@router.post("/logout")
def logout():
    response = JSONResponse({"message": "logged out"})
    clear_auth_cookie(response)
    return response


@router.delete("/delete")
def delete_account(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db.delete(current_user)
    db.commit()
    response = JSONResponse({"message": "account deleted"})
    clear_auth_cookie(response)
    return response


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user
