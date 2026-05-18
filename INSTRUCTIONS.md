# Local Development Guide

Every `git push origin main` auto-deploys to the Pi. Changes to Python/HTML/JS take ~30 seconds. Only `requirements.txt` or `Dockerfile` changes trigger a full ~12 min rebuild.

---

## First-time setup (Arch Linux)

Install Docker if you don't have it:

```bash
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and back in after this
```

Create a local `.env` file in the repo root (already gitignored):

```bash
cat > .env <<EOF
DB_PASSWORD=local_dev_pass
SECRET_KEY=local_dev_secret_change_me
EOF
```

---

## Day-to-day workflow

```
1. git pull                   ← get latest from Pi deploys or teammates
2. uvicorn --reload           ← develop with hot reload (see Scenario B below)
3. edit → save → refresh browser...
4. docker compose up --build  ← final sanity check before pushing
5. git add + commit + push    ← auto-deploys to Pi
6. Visit https://tew-empire.online to confirm it's live
```

---

## Scenario A — Full Docker stack (closest to production)

Use this for a final check before pushing, or when you need Nginx + Postgres + backend all running together.

```bash
# Start everything
docker compose up --build

# Open in browser (Nginx port)
# http://localhost:8080

# Stop
docker compose down

# Stop + wipe local Postgres data (fresh start)
docker compose down -v

# View backend logs only
docker compose logs -f backend

# Rebuild after changing requirements.txt or Dockerfile
docker compose up --build
```

> Note: port is `8080` because `docker-compose.yml` binds `127.0.0.1:8080:80` — only reachable from your laptop, same as production.

---

## Scenario B — Native uvicorn (faster for Python edits)

Use this for everyday development. Uvicorn auto-reloads on every file save — no Docker rebuild needed.

**Step 1** — Start Postgres in Docker (only needs to run once per session):

```bash
docker run -d --name local-pg \
  -e POSTGRES_DB=tactine_rpg \
  -e POSTGRES_USER=tactine \
  -e POSTGRES_PASSWORD=local_dev_pass \
  -p 127.0.0.1:5432:5432 \
  postgres:15-alpine
```

**Step 2** — Set up the Python venv (first time only):

```bash
cd backend
python -m venv venv
pip install --upgrade pip
pip install -r requirements.txt
```

**Step 3** — Run the backend:

```bash
cd backend
source venv/bin/activate

export DATABASE_URL="postgresql+psycopg://tactine:local_dev_pass@localhost:5432/tactine_rpg"
export SECRET_KEY="local_dev_secret"
export FRONTEND="$(pwd)/.."

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000** — FastAPI serves everything directly (no Nginx). Edit any `.py` file and uvicorn reloads automatically.

**Step 4** — When done:

```bash
deactivate
docker stop local-pg && docker rm local-pg
```

---

## Which scenario to use?

| Situation | Use |
|---|---|
| Editing Python routes, auth logic, game API | Scenario B (fast reload) |
| Editing HTML/JS/CSS frontend files | Scenario B (fast reload) |
| Testing Nginx behavior or full stack integration | Scenario A (Docker) |
| Final check before pushing to production | Scenario A (Docker) |

---

## What triggers a slow rebuild on the Pi (~12 min)

- Changing `backend/requirements.txt`
- Changing `backend/Dockerfile`

Everything else (Python, HTML, JS, assets, configs) deploys in ~30 seconds.
