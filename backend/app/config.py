from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# .env lives in the project root (two levels above this file: app/ → backend/ → project/)
_ENV_FILE = Path(__file__).parent.parent.parent / ".env"  # app/ → backend/ → project/ → .env

# Verify path: __file__ is backend/app/config.py
# .parent      = backend/app/
# .parent.parent = backend/
# .parent.parent.parent = Tactine-RPG-Web-Game/  ← correct

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        extra="ignore",   # ignore DB_PASSWORD and any other Docker-only vars
    )

    database_url: str = "postgresql+psycopg://tactine:tactine_pass@postgres:5432/tactine_rpg"
    secret_key: str   = "change-this-in-production"
    algorithm: str    = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

settings = Settings()
