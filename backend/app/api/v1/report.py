from __future__ import annotations

import contextlib
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.api.deps import get_app_settings, get_db
from app.core.auth import get_current_user
from app.core.config import Settings
from app.core.ratelimit import rate_limit
from app.core.s3 import download_to_path, presign_get
from app.domain.audit.repository import get_analysis, get_dataset, get_model
from app.services.report_service import ReportResult, generate_report

router = APIRouter(tags=["report"])


class ReportRequest(BaseModel):
    dataset_id: int
    model_id: int
    sensitive_attribute: str | None = None
    privileged_values: list | None = None
    unprivileged_values: list | None = None
    positive_label: int | float | str = 1


class ReportResponse(BaseModel):
    txt_path: str


@router.post(
    "/report/generate",
    response_model=ReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate audit report (HTML/PDF)",
)
async def generate_report_endpoint(
    payload: ReportRequest,
    _: None = Depends(rate_limit),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    user_id: str = Depends(get_current_user),
) -> ReportResponse:
    dataset = await get_dataset(db, payload.dataset_id, user_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    model = await get_model(db, payload.model_id, user_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")

    result: ReportResult = generate_report(
        dataset=dataset,
        model=model,
        settings=settings,
        sensitive_attribute=payload.sensitive_attribute,
        privileged_values=payload.privileged_values,
        unprivileged_values=payload.unprivileged_values,
        positive_label=payload.positive_label,
    )
    return ReportResponse(
        txt_path=str(result.txt_path),
    )


@router.get(
    "/report/analysis/{analysis_id}/download",
    summary="Download a saved analysis TXT report (owner-bound)",
)
async def download_analysis_report(
    analysis_id: int,
    _: None = Depends(rate_limit),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    user_id: str = Depends(get_current_user),
):
    row = await get_analysis(db, analysis_id, user_id)
    if not row or not row.report_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # If stored in S3, download to a temp file under reports_path and serve it (owner-bound).
    if row.report_path.startswith("s3://"):
        try:
            without_scheme = row.report_path[len("s3://") :]
            bucket, key = without_scheme.split("/", 1)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid S3 report URI"
            ) from exc

        tmp_dir = (settings.reports_path / "_downloads").resolve()
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp_path = tmp_dir / f"analysis_{analysis_id}_report.txt"

        try:
            download_to_path(settings, bucket, key, str(tmp_path))
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to fetch report from storage",
            ) from exc

        def _cleanup(p: str) -> None:
            with contextlib.suppress(Exception):
                Path(p).unlink(missing_ok=True)  # type: ignore[arg-type]

        return FileResponse(
            str(tmp_path),
            filename=tmp_path.name,
            media_type="text/plain",
            background=BackgroundTask(_cleanup, str(tmp_path)),
        )

    report_path = Path(row.report_path)

    try:
        base = settings.reports_path.resolve()
        resolved = report_path.resolve()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid report path"
        ) from exc

    # Prevent path traversal / arbitrary file reads
    if base not in resolved.parents and resolved != base:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden path")

    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file missing")

    return FileResponse(str(resolved), filename=resolved.name, media_type="text/plain")


@router.get(
    "/report/analysis/{analysis_id}/presign",
    summary="Get a presigned URL for a saved analysis report (S3 only)",
)
async def presign_analysis_report(
    analysis_id: int,
    _: None = Depends(rate_limit),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    user_id: str = Depends(get_current_user),
):
    row = await get_analysis(db, analysis_id, user_id)
    if not row or not row.report_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    if not row.report_path.startswith("s3://"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Report is not stored in S3"
        )

    try:
        without_scheme = row.report_path[len("s3://") :]
        bucket, key = without_scheme.split("/", 1)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid S3 report URI"
        ) from exc

    try:
        url = presign_get(settings, bucket, key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Storage not configured"
        ) from exc

    return {"url": url}
