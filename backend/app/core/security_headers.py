from __future__ import annotations

from fastapi import Request
from starlette.responses import Response

from app.core.config import get_settings


async def security_headers_middleware(request: Request, call_next):
    """
    Lightweight security headers suitable for API responses.

    Notes:
    - Keep CSP minimal to avoid breaking future UI hosting on same domain.
    - For Vercel/DO behind a reverse proxy, you may also configure headers at the edge.
    """
    response: Response = await call_next(request)
    settings = get_settings()

    # Basic hardening
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

    # Minimal CSP (API-only). If you ever serve HTML from backend, revisit this.
    if settings.app_env == "prod":
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")

    return response


