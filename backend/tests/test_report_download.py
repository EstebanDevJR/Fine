from __future__ import annotations

import importlib
import uuid
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from jose import jwt

from app.core import config as config_mod


def _token(sub: str) -> str:
    settings = config_mod.get_settings()
    secret = settings.supabase_jwt_secret or "test-secret"
    iss = f"{str(settings.supabase_url).rstrip('/')}/auth/v1" if settings.supabase_url else None
    payload = {"sub": sub}
    if iss:
        payload["iss"] = iss
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.mark.asyncio
async def test_report_download_owner_bound(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    # Configure storage paths for the test
    monkeypatch.setenv("REPORTS_PATH", str(tmp_path / "reports"))
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path/'test.db'}")
    monkeypatch.setenv("AUTO_CREATE_DB", "true")
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")

    # Recreate modules that hold global engine/settings
    config_mod.get_settings.cache_clear()  # type: ignore[attr-defined]
    import app.db.session as session_mod
    import app.main as main_mod

    importlib.reload(session_mod)
    importlib.reload(main_mod)

    app = main_mod.create_app()
    await session_mod.init_db()

    owner_id = str(uuid.uuid4())
    other_id = str(uuid.uuid4())

    reports_dir = Path(config_mod.get_settings().reports_path)
    reports_dir.mkdir(parents=True, exist_ok=True)
    report_file = reports_dir / "report_test.txt"
    report_file.write_text("hello", encoding="utf-8")

    from app.domain.audit.repository import create_analysis

    async with session_mod.AsyncSessionLocal() as db:
        analysis = await create_analysis(
            db,
            owner_id=owner_id,
            dataset_id=1,
            model_id=1,
            status="completed",
            result_json="{}",
            report_path=str(report_file),
        )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Wrong owner => 404 (because repository is owner-filtered)
        r = await client.get(
            f"/api/v1/report/analysis/{analysis.id}/download",
            headers={"Authorization": f"Bearer {_token(other_id)}"},
        )
        assert r.status_code == 404

        # Correct owner => 200 and content
        r2 = await client.get(
            f"/api/v1/report/analysis/{analysis.id}/download",
            headers={"Authorization": f"Bearer {_token(owner_id)}"},
        )
        assert r2.status_code == 200
        assert "hello" in r2.text
