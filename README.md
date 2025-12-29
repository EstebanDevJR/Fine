# Fine — ML Audit Full‑Stack (Portfolio)

Proyecto personal full‑stack para demostrar habilidades en **arquitectura, ML tooling y producto**: subida de datasets/modelos → auditoría automática → progreso en vivo → resultados persistidos → descarga de reportes.

## Qué hace
- **Auth** con Supabase (Bearer JWT).
- **Uploads** de datasets y modelos (local o S3 presigned upload).
- **Auditoría async** con Celery (pipeline de métricas, XAI, robustness, fairness opcional, diagnóstico LLM y reporte TXT).
- **Progreso en vivo** vía **SSE** (Server‑Sent Events).
- **Analyses vault** (historial por usuario) + descarga de **TXT report** owner‑bound.
- **Observabilidad** ligera: `X-Request-ID` + `/metrics` (counters y timings).

## Tech stack
- **Frontend**: React + Vite + TypeScript, TanStack Router/Query, Supabase JS.
- **Backend**: FastAPI, SQLModel/SQLAlchemy async, Celery + Redis, JWT verification (Supabase).
- **Storage**: local y/o S3 (presigned GET para reportes).
- **CI**: GitHub Actions (backend lint/tests + frontend lint/build/tests).

## Arquitectura (alto nivel)
- **Frontend** consume `API_BASE` (`/api/v1`) con token Supabase en `Authorization: Bearer ...`.
- **Backend** valida JWT, aplica rate-limit por user (fallback IP), ejecuta tareas async en Celery y expone:
  - `POST /audit/full` → inicia job (Celery)
  - `GET /audit/full/{job_id}/events` → SSE con progreso
  - `GET /audit/analyses` → historial owner‑bound
  - `GET /report/analysis/{analysis_id}/download` → descarga TXT owner‑bound

## Ejecutar en local (Windows-friendly)

### Requisitos
- Python 3.11+
- Bun (frontend)
- Redis (para Celery). Puedes usar Docker si prefieres.

### Backend
1) Copia env:
- `backend/env.example` → `backend/.env`

2) Instala:
- `cd backend`
- `pip install -e ".[dev]"` *(o `uv pip install --system ".[dev]"`)*

3) API:
- `uvicorn app.main:app --reload`

4) Worker:
- `celery -A app.workers.tasks worker --pool=solo -l info`

### Frontend
- `cd frontend`
- `bun install`
- `bun run dev`

## Tests
- Frontend:
  - `cd frontend && bun run test`
- Backend:
  - `cd backend && python -m pytest`

## Demo flow
1) Login
2) Upload dataset + model
3) Run Full Audit
4) Ver progreso (SSE) en pantalla
5) Abrir Analyses → revisar resultados
6) Descargar TXT report

## Deploy (DigitalOcean + Vercel)

### Backend (DigitalOcean)
Variables mínimas:
- `CORS_ORIGINS=https://<tu-app>.vercel.app`
- `SUPABASE_URL`, `SUPABASE_JWT_SECRET`
- `DATABASE_URL`, `REDIS_URL`

Recomendado:
- `AUTO_CREATE_DB=false` y correr migraciones:
  - `alembic upgrade head`

Opcional S3:
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- `S3_BUCKET_DATASETS`, `S3_BUCKET_MODELS`, `S3_BUCKET_REPORTS`, `S3_BUCKET_ARTIFACTS`

### Frontend (Vercel)
- `VITE_API_BASE=https://<tu-backend>/api/v1`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## CI
Workflow en `.github/workflows/ci.yml`:
- Backend: `ruff` + `black --check` + `pytest`
- Frontend: `eslint` + `build` + `vitest`

## Seguridad (resumen)
- Descargas de reportes **owner‑bound** (sin `path=` libre).
- CORS configurable (sin `*` con credentials).
- Rate-limit por usuario.
- Headers básicos de hardening.

## Docs adicionales
- Backend: `backend/README.md`
- Frontend: `frontend/README.md`


