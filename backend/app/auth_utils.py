from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Cookie, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app import models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

COOKIE_NAME = "tew_token"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    return jwt.encode({"sub": user_id, "exp": expire}, settings.secret_key, algorithm=settings.algorithm)

def _decode(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload.get("sub")
    except JWTError:
        return None


# ── For API routes — raises 401 if cookie missing or invalid ──────────
def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> models.User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = _decode(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── For page routes — redirects to /auth instead of raising ──────────
def require_auth_page(request: Request, db: Session = Depends(get_db)) -> models.User:
    token = request.cookies.get(COOKIE_NAME)
    user_id = _decode(token) if token else None
    if not user_id:
        raise HTTPException(status_code=302, headers={"Location": "/auth"})
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=302, headers={"Location": "/auth"})
    return user


def set_auth_cookie(response, token: str, is_local: bool = False):
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=not is_local,   # False on localhost (http), True on production (https)
        max_age=60 * 60 * 24 * 7,  # 7 days
        path="/",
    )

def clear_auth_cookie(response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
