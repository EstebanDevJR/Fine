from __future__ import annotations

import time
from typing import Dict

import re
from prometheus_client import Counter as PromCounter
from prometheus_client import Histogram, CollectorRegistry, generate_latest

Counters = Dict[str, int]
Timings = Dict[str, float]

COUNTERS: Counters = {}
TIMINGS_MS: Timings = {}

REGISTRY = CollectorRegistry()
PROM_COUNTERS: Dict[str, PromCounter] = {}
PROM_HIST: Dict[str, Histogram] = {}


def _sanitize_name(name: str) -> str:
    """Convert metric names to Prometheus-compatible."""
    safe = re.sub(r"[^a-zA-Z0-9_:]", "_", name)
    if not safe or not re.match(r"[a-zA-Z_]", safe[0]):
        safe = f"m_{safe}"
    return safe


def _prom_counter(name: str) -> PromCounter:
    safe = _sanitize_name(name)
    if safe not in PROM_COUNTERS:
        PROM_COUNTERS[safe] = PromCounter(safe, name, registry=REGISTRY)
    return PROM_COUNTERS[safe]


def _prom_hist(name: str) -> Histogram:
    safe = _sanitize_name(name)
    if safe not in PROM_HIST:
        PROM_HIST[safe] = Histogram(safe, name, registry=REGISTRY)
    return PROM_HIST[safe]


def incr(metric: str, value: int = 1) -> None:
    COUNTERS[metric] = COUNTERS.get(metric, 0) + value
    _prom_counter(metric).inc(value)


def observe_time(metric: str, elapsed_ms: float) -> None:
    TIMINGS_MS[metric] = elapsed_ms
    _prom_hist(metric).observe(elapsed_ms / 1000.0)  # seconds for Prometheus


def timed(metric: str):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                return await func(*args, **kwargs)
            finally:
                elapsed_ms = (time.perf_counter() - start) * 1000
                observe_time(metric, elapsed_ms)

        return wrapper

    return decorator


def render_prometheus() -> bytes:
    return generate_latest(REGISTRY)

