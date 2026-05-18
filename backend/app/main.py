import os
from fastapi import FastAPI, Depends, Request
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import auth, user, world
from app.auth_utils import get_current_user, COOKIE_NAME, _decode
import app.models

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Tactine RPG API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://localhost:3000"],
    allow_credentials=True,   # required for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routes ────────────────────────────────────────────────────────
app.include_router(auth.router,  prefix="/api/auth",  tags=["Auth"])
app.include_router(user.router,  prefix="/api/user",  tags=["User"])
app.include_router(world.router, prefix="/api/world", tags=["World"])

# ── Determine path to the frontend files ─────────────────────────────
# backend/ lives inside the project; go one level up.
FRONTEND = os.environ.get("FRONTEND", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))


def _is_authed(request: Request) -> bool:
    token = request.cookies.get(COOKIE_NAME)
    return bool(token and _decode(token))


# ── Page routes ───────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
def landing():
    return FileResponse(os.path.join(FRONTEND, "index.html"))


@app.get("/auth", include_in_schema=False)
def auth_page(request: Request):
    if _is_authed(request):
        return RedirectResponse("/game")
    return FileResponse(os.path.join(FRONTEND, "auth.html"))


@app.get("/game", include_in_schema=False)
def game_page(request: Request):
    if not _is_authed(request):
        return RedirectResponse("/auth")
    return FileResponse(os.path.join(FRONTEND, "game.html"))


# ── Static assets (JS, CSS, images) ──────────────────────────────────
app.mount("/src",    StaticFiles(directory=os.path.join(FRONTEND, "src")),    name="src")
app.mount("/Assets", StaticFiles(directory=os.path.join(FRONTEND, "Assets")), name="assets")


@app.get("/api/health")
def health():
    return {"status": "ok"}
