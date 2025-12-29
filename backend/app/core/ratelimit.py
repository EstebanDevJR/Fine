from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status


class SimpleRateLimiter:
    def __init__(self, limit_per_minute: int, burst: int):
        self.limit_per_minute = limit_per_minute
        self.burst = burst
        self.tokens: defaultdict[str, float] = defaultdict(lambda: burst)
        self.timestamp: defaultdict[str, float] = defaultdict(time.time)

    def allow(self, key: str) -> bool:
        now = time.time()
        last = self.timestamp[key]
        # refill tokens
        elapsed = now - last
        refill = elapsed * (self.limit_per_minute / 60)
        self.tokens[key] = min(self.burst, self.tokens[key] + refill)
        self.timestamp[key] = now

        if self.tokens[key] >= 1:
            self.tokens[key] -= 1
            return True
        return False


limiter: SimpleRateLimiter | None = None


def init_limiter(limit: int, burst: int):
    global limiter
    limiter = SimpleRateLimiter(limit, burst)


async def rate_limit(request: Request):
    if limiter is None:
        return
    # Prefer authenticated user_id (set by auth dependency), fallback to client IP.
    key = getattr(request.state, "user_id", None) or (
        request.client.host if request.client else "anonymous"
    )
    if not limiter.allow(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )
