# Running the App Locally

PostgreSQL is not installed as a system service — use Docker for the database only, then run the backend with uvicorn.

## Steps

**1. Start PostgreSQL via Docker (from project root):**
```bash
docker compose up postgres -d
```

**2. Activate the venv and start the backend:**
```bash
cd backend
source venv/bin/activate



```

**3. Open the app:** http://localhost:8000

## Notes

- The `.env` file has `DATABASE_URL` pointing to `localhost:5432`, which matches the Docker Postgres container.
- The FastAPI server serves the frontend HTML pages and static files — no separate frontend server needed.
- To stop the database: `docker compose down` (from project root). Add `-v` to also wipe the database volume.
