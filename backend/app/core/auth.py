from __future__ import annotations

import time
from typing import Any, Optional

import httpx
from fastapi import Depends, HTTPException, Header, Request, status
from jose import jwt
from jose.exceptions import JWTError, ExpiredSignatureError

from app.core.config import Settings, get_settings


class JWKSCache:
    def __init__(self) -> None:
        self.keys: dict[str, Any] = {}
        self.fetched_at = 0.0

    def is_stale(self, ttl: int = 3600) -> bool:
        return (time.time() - self.fetched_at) > ttl

    async def refresh(self, jwks_url: str) -> None:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(jwks_url)
            resp.raise_for_status()
            data = resp.json()
            self.keys = {k["kid"]: k for k in data.get("keys", [])}
            self.fetched_at = time.time()

    def get_key(self, kid: str) -> Optional[dict[str, Any]]:
        return self.keys.get(kid)


_jwks_cache = JWKSCache()


def _expected_issuer(settings: Settings) -> str | None:
    """Supabase access tokens typically use issuer: https://<project>.supabase.co/auth/v1"""
    if not settings.supabase_url:
        return None
    base = str(settings.supabase_url).rstrip("/")
    return f"{base}/auth/v1"


async def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
    authorization: str | None = Header(default=None, convert_underscores=False),
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    token = authorization.removeprefix("Bearer ").strip()

    # Decode header to get kid and algorithm
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        alg = header.get("alg")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token header")

    # HS256 tokens (Supabase default) use the project's JWT secret, not the anon token value.
    if alg == "HS256":
        if not settings.supabase_jwt_secret:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Auth not configured")

        try:
            claims = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=None,
                options={"verify_aud": False, "verify_exp": True},
            )
        except ExpiredSignatureError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        except (JWTError, Exception):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    else:
        # RS256 path via JWKS
        if not settings.supabase_jwks_url:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="JWKS URL not configured")
        
        if _jwks_cache.is_stale() or not _jwks_cache.get_key(kid):
            try:
                await _jwks_cache.refresh(str(settings.supabase_jwks_url))
            except Exception:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Cannot fetch JWKS")

        key = _jwks_cache.get_key(kid)
        if not key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        try:
            claims = jwt.decode(token, key, algorithms=["RS256"], audience=None, options={"verify_aud": False, "verify_exp": True})
        except ExpiredSignatureError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
        except (JWTError, Exception):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    expected_iss = _expected_issuer(settings)
    if expected_iss:
        iss = claims.get("iss")
        if iss != expected_iss:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token issuer")

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user_id_str = str(user_id)
    # Attach to request for rate limiting / logging
    try:
        request.state.user_id = user_id_str
    except Exception:
        pass
    return user_id_str

