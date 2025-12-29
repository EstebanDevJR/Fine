## Fine Audit Backend

Backend FastAPI + Celery para la auditoría automática de modelos ML.

### Requisitos
- Python 3.11+
- uv (`pip install uv`) o pip
- Docker + Docker Compose (opcional para entorno completo)

### Configuración rápida
1) Copia `env.example` a `.env` y ajusta valores (Redis, OpenAI, etc.).
2) Instala dependencias:
   - `uv pip install --system .` (recomendado)
   - o `pip install -e .`
3) Ejecuta API:
   - `uvicorn app.main:app --reload`
4) Ejecuta worker Celery:
   - `celery -A app.workers.tasks worker --loglevel=info`

### Con Docker
```
docker compose up --build
```

API en `http://localhost:8000/health`.

