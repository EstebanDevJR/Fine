from __future__ import annotations

import json
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_app_settings, get_db
from app.core.auth import get_current_user
from app.core.config import Settings
from app.core.s3 import delete_s3_uri
from app.domain.audit.repository import (
    delete_analysis,
    delete_dataset,
    delete_model,
    list_analyses,
    list_analyses_by_dataset,
    list_analyses_by_model,
)
from app.domain.audit.service import list_datasets, list_models

router = APIRouter()


async def _delete_analysis_artifacts(db: AsyncSession, user_id: str, settings: Settings) -> None:
    analyses = await list_analyses(db, user_id)
    for a in analyses:
        try:
            if a.report_path and not a.report_path.startswith("s3://"):
                Path(a.report_path).unlink(missing_ok=True)  # type: ignore[arg-type]
            if a.pdf_path and a.pdf_path and not a.pdf_path.startswith("s3://"):
                Path(a.pdf_path).unlink(missing_ok=True)  # type: ignore[arg-type]
        except Exception:
            pass
        if a.report_path and a.report_path.startswith("s3://"):
            try:
                delete_s3_uri(settings, a.report_path)
            except Exception:
                pass
        if a.pdf_path and a.pdf_path.startswith("s3://"):
            try:
                delete_s3_uri(settings, a.pdf_path)
            except Exception:
                pass
        await delete_analysis(db, a.id, user_id)


async def _delete_datasets(db: AsyncSession, user_id: str, settings: Settings) -> None:
    datasets = await list_datasets(db, user_id)
    for d in datasets:
        analyses = await list_analyses_by_dataset(db, d.id, user_id)
        for a in analyses:
            try:
                if a.report_path and not a.report_path.startswith("s3://"):
                    Path(a.report_path).unlink(missing_ok=True)  # type: ignore[arg-type]
                if a.pdf_path and a.pdf_path and not a.pdf_path.startswith("s3://"):
                    Path(a.pdf_path).unlink(missing_ok=True)  # type: ignore[arg-type]
            except Exception:
                pass
            if a.report_path and a.report_path.startswith("s3://"):
                try:
                    delete_s3_uri(settings, a.report_path)
                except Exception:
                    pass
            if a.pdf_path and a.pdf_path.startswith("s3://"):
                try:
                    delete_s3_uri(settings, a.pdf_path)
                except Exception:
                    pass
            await delete_analysis(db, a.id, user_id)
        try:
            Path(d.path).unlink(missing_ok=True)  # type: ignore[arg-type]
        except Exception:
            pass
        if d.s3_uri:
            try:
                delete_s3_uri(settings, d.s3_uri)
            except Exception:
                pass
        await delete_dataset(db, d.id, user_id)


async def _delete_models(db: AsyncSession, user_id: str, settings: Settings) -> None:
    models = await list_models(db, user_id)
    for m in models:
        analyses = await list_analyses_by_model(db, m.id, user_id)
        for a in analyses:
            try:
                if a.report_path and not a.report_path.startswith("s3://"):
                    Path(a.report_path).unlink(missing_ok=True)  # type: ignore[arg-type]
                if a.pdf_path and a.pdf_path and not a.pdf_path.startswith("s3://"):
                    Path(a.pdf_path).unlink(missing_ok=True)  # type: ignore[arg-type]
            except Exception:
                pass
            if a.report_path and a.report_path.startswith("s3://"):
                try:
                    delete_s3_uri(settings, a.report_path)
                except Exception:
                    pass
            if a.pdf_path and a.pdf_path.startswith("s3://"):
                try:
                    delete_s3_uri(settings, a.pdf_path)
                except Exception:
                    pass
            await delete_analysis(db, a.id, user_id)
        try:
            Path(m.path).unlink(missing_ok=True)  # type: ignore[arg-type]
        except Exception:
            pass
        if m.s3_uri:
            try:
                delete_s3_uri(settings, m.s3_uri)
            except Exception:
                pass
        await delete_model(db, m.id, user_id)


async def _delete_supabase_user(settings: Settings, user_id: str) -> None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return
    base_url = str(settings.supabase_url).rstrip("/")
    url = f"{base_url}/auth/v1/admin/users/{user_id}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.delete(url, headers=headers)
            if resp.status_code in (200, 204, 404):
                return
            else:
                try:
                    payload = resp.json()
                except json.JSONDecodeError:
                    payload = resp.text
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to delete auth user: {payload}",
                )
    except HTTPException:
        raise
    except Exception:
        # Best-effort: swallow errors so user data is still removed from our DB
        pass


@router.delete(
    "/account",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete my account and data",
)
async def delete_account(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    # Delete analyses first, then datasets/models and their linked analyses, then the auth user
    await _delete_analysis_artifacts(db, user_id, settings)
    await _delete_datasets(db, user_id, settings)
    await _delete_models(db, user_id, settings)
    await _delete_supabase_user(settings, user_id)
    return {}

