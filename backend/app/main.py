from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1 import router as api_router
from app.core.config import get_settings
from app.core.middleware import request_id_middleware
from app.core.logging import configure_logging
from app.core.security_headers import security_headers_middleware
from app.db.session import init_db
from app.core.ratelimit import init_limiter

logger = logging.getLogger(__name__)


def _ensure_directories(paths: list[Path]) -> None:
    for path in paths:
        path.mkdir(parents=True, exist_ok=True)
        logger.info("Ensured directory exists", extra={"path": str(path)})


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings)
    if settings.enable_rate_limit:
        init_limiter(settings.rate_limit_per_minute, settings.rate_limit_burst)
    _ensure_directories(
        [
            settings.data_path,
            settings.storage_base_path,
            settings.reports_path,
            settings.models_path,
            settings.datasets_path,
            settings.artifacts_path,
        ]
    )
    await init_db()
    logger.info("Startup complete")
    yield
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        middleware=[
            Middleware(BaseHTTPMiddleware, dispatch=request_id_middleware),
            Middleware(BaseHTTPMiddleware, dispatch=security_headers_middleware),
        ],
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()

