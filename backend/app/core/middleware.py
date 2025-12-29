from __future__ import annotations

import time
import uuid
from typing import Callable

from fastapi import Request, Response

from app.core.metrics import incr, observe_time


async def request_id_middleware(request: Request, call_next: Callable):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()
    response: Response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000

    # attach header
    response.headers["X-Request-ID"] = request_id

    # metrics per route/status
    route = request.url.path.replace("/", "_").strip("_") or "root"
    status = response.status_code
    incr(f"requests_total_{route}_{status}")
    observe_time(f"requests_ms_{route}", elapsed_ms)
    return response

