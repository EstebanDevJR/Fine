# Fine — ML Audit Full‑Stack (Portfolio)

Fine is a personal full‑stack project showcasing **end‑to‑end ML model auditing**:
uploads (datasets/models) → async audit pipeline (Celery) → live progress → saved analyses → report downloads.

## Local run (Windows-friendly)

### Backend
- Copy `backend/env.example` → `backend/.env`
- Install:
  - `pip install -e "backend.[dev]"` (or `uv pip install --system ".[dev]"` inside `backend/`)
- Run API:
  - `cd backend`
  - `uvicorn app.main:app --reload`
- Run worker:
  - `cd backend`
  - `celery -A app.workers.tasks worker --pool=solo -l info`

### Frontend
- `cd frontend`
- `bun install`
- `bun run dev`

## Demo flow
- **Login** (Supabase)
- **Upload** a dataset + model
- **Run Full Audit**
  - Watch **live progress** (SSE, no polling)
- Open **Analyses**
  - Inspect metrics / fairness / diagnose
  - **Download TXT report**

## Deploy notes (DigitalOcean + Vercel)

### Backend env (DigitalOcean)
- `CORS_ORIGINS=https://<your-vercel-app>.vercel.app`
- `SUPABASE_URL`, `SUPABASE_JWT_SECRET`
- `DATABASE_URL`, `REDIS_URL`
- Optional S3: `AWS_*` and `S3_BUCKET_*`
- Recommended: `AUTO_CREATE_DB=false` and run Alembic migrations.

### Frontend env (Vercel)
- `VITE_API_BASE=https://<your-backend>/api/v1`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## CI
GitHub Actions runs:
- Backend: ruff + black + pytest
- Frontend: eslint + build + vitest


