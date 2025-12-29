from __future__ import annotations

from fastapi import APIRouter, Response
from pydantic import BaseModel

from app.core.metrics import COUNTERS, TIMINGS_MS, render_prometheus

router = APIRouter(tags=["metrics"])


class MetricSnapshot(BaseModel):
    counters: dict[str, int]
    timings_ms: dict[str, float]


@router.get("/metrics", response_model=MetricSnapshot, summary="Lightweight metrics (in-memory)")
async def get_metrics() -> MetricSnapshot:
    return MetricSnapshot(counters=COUNTERS, timings_ms=TIMINGS_MS)


@router.get("/metrics/prometheus", summary="Prometheus metrics text format")
async def get_metrics_prometheus():
    content = render_prometheus()
    return Response(content=content, media_type="text/plain; version=0.0.4")
