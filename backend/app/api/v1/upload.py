from __future__ import annotations

import contextlib
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_app_settings, get_db
from app.core.auth import get_current_user
from app.core.config import Settings
from app.core.ratelimit import rate_limit
from app.core.s3 import build_s3_path, delete_s3_uri, download_to_path, presign_put
from app.domain.audit.repository import (
    delete_analysis,
    delete_dataset,
    delete_model,
    get_dataset,
    get_model,
    list_analyses_by_dataset,
    list_analyses_by_model,
)
from app.domain.audit.schemas import DatasetResponse, ModelResponse
from app.domain.audit.service import create_dataset, create_model
from app.utils.file_utils import compute_checksum, save_upload_file
from app.utils.validation import ALLOWED_DATASET_EXT, ALLOWED_MODEL_EXT, ensure_allowed_extension

router = APIRouter(tags=["upload"])


def _safe_dest(base: Path, name: str, ext: str) -> Path:
    uid = uuid.uuid4().hex
    safe_name = name.replace(" ", "_")
    return base / f"{safe_name}_{uid}.{ext}"


def _require_bucket(value: str | None, kind: str) -> str:
    if not value:
        raise HTTPException(status_code=500, detail=f"S3 bucket for {kind} not configured")
    return value


@router.post(
    "/upload/dataset",
    response_model=DatasetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Subir dataset",
)
async def upload_dataset(
    *,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    user_id: str = Depends(get_current_user),
    _: None = Depends(rate_limit),
    target_column: str = Form(...),
    name: str | None = Form(None),
    file: UploadFile = File(...),
):
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (>10MB)")

    ext = ensure_allowed_extension(file.filename, ALLOWED_DATASET_EXT)
    safe_name = name or file.filename.rsplit(".", 1)[0]
    destination = _safe_dest(settings.datasets_path, safe_name, ext)
    size, checksum = await save_upload_file(file, destination)

    record = await create_dataset(
        db,
        owner_id=user_id,
        name=safe_name,
        filename=file.filename,
        path=str(destination),
        s3_uri=None,
        file_format=ext,
        size_bytes=size,
        target_column=target_column,
        checksum=checksum,
    )
    return DatasetResponse.model_validate(record)


@router.post(
    "/upload/presign/dataset",
    summary="Obtener URL prefirmada para subir dataset a S3",
)
async def presign_dataset_s3(
    *,
    settings: Settings = Depends(get_app_settings),
    user_id: str = Depends(get_current_user),
    filename: str = Form(...),
    content_type: str = Form("text/csv"),
):
    ext = ensure_allowed_extension(filename, ALLOWED_DATASET_EXT)
    bucket = _require_bucket(settings.s3_bucket_datasets, "datasets")
    key = build_s3_path("datasets", user_id, filename)
    presigned = presign_put(settings, bucket, key, content_type, max_size_bytes=10 * 1024 * 1024)
    return {
        "upload_url": presigned["url"],
        "fields": presigned["fields"],
        "key": key,
        "bucket": bucket,
        "ext": ext,
    }


@router.post(
    "/upload/dataset/confirm",
    response_model=DatasetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Confirmar dataset subido a S3 y registrarlo",
)
async def confirm_dataset_s3(
    *,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    user_id: str = Depends(get_current_user),
    key: str = Form(...),
    filename: str = Form(...),
    target_column: str = Form(...),
    name: str | None = Form(None),
):
    ext = ensure_allowed_extension(filename, ALLOWED_DATASET_EXT)
    bucket = _require_bucket(settings.s3_bucket_datasets, "datasets")
    safe_name = name or filename.rsplit(".", 1)[0]
    destination = _safe_dest(settings.datasets_path, safe_name, ext)
    download_to_path(settings, bucket, key, str(destination))

    with destination.open("rb") as f:
        checksum = compute_checksum(f)
    size = destination.stat().st_size

    record = await create_dataset(
        db,
        owner_id=user_id,
        name=safe_name,
        filename=filename,
        path=str(destination),
        s3_uri=f"s3://{bucket}/{key}",
        file_format=ext,
        size_bytes=size,
        target_column=target_column,
        checksum=checksum,
    )
    return DatasetResponse.model_validate(record)


@router.get(
    "/datasets",
    response_model=list[DatasetResponse],
    summary="Listar datasets",
)
async def list_datasets(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    from app.domain.audit.service import list_datasets

    records = await list_datasets(db, user_id)
    return [DatasetResponse.model_validate(r) for r in records]


@router.post(
    "/upload/model",
    response_model=ModelResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Subir modelo",
)
async def upload_model(
    *,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    user_id: str = Depends(get_current_user),
    _: None = Depends(rate_limit),
    framework: str = Form(..., description="sklearn | xgboost | pytorch | onnx"),
    task_type: str | None = Form(None, description="classification | regression | other"),
    description: str | None = Form(None),
    name: str | None = Form(None),
    file: UploadFile = File(...),
):
    if file.size and file.size > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (>50MB)")

    ext = ensure_allowed_extension(file.filename, ALLOWED_MODEL_EXT)
    safe_name = name or file.filename.rsplit(".", 1)[0]
    destination = _safe_dest(settings.models_path, safe_name, ext)
    size, checksum = await save_upload_file(file, destination)

    record = await create_model(
        db,
        owner_id=user_id,
        name=safe_name,
        framework=framework,
        task_type=task_type,
        description=description,
        filename=file.filename,
        path=str(destination),
        s3_uri=None,
        size_bytes=size,
        checksum=checksum,
    )
    return ModelResponse.model_validate(record)


@router.post(
    "/upload/presign/model",
    summary="Obtener URL prefirmada para subir modelo a S3",
)
async def presign_model_s3(
    *,
    settings: Settings = Depends(get_app_settings),
    user_id: str = Depends(get_current_user),
    filename: str = Form(...),
    content_type: str = Form("application/octet-stream"),
):
    ext = ensure_allowed_extension(filename, ALLOWED_MODEL_EXT)
    bucket = _require_bucket(settings.s3_bucket_models, "models")
    key = build_s3_path("models", user_id, filename)
    presigned = presign_put(settings, bucket, key, content_type, max_size_bytes=50 * 1024 * 1024)
    return {
        "upload_url": presigned["url"],
        "fields": presigned["fields"],
        "key": key,
        "bucket": bucket,
        "ext": ext,
    }


@router.post(
    "/upload/model/confirm",
    response_model=ModelResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Confirmar modelo subido a S3 y registrarlo",
)
async def confirm_model_s3(
    *,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    user_id: str = Depends(get_current_user),
    key: str = Form(...),
    filename: str = Form(...),
    framework: str = Form(..., description="sklearn | xgboost | pytorch | onnx"),
    task_type: str | None = Form(None, description="classification | regression | other"),
    description: str | None = Form(None),
    name: str | None = Form(None),
):
    ext = ensure_allowed_extension(filename, ALLOWED_MODEL_EXT)
    bucket = _require_bucket(settings.s3_bucket_models, "models")
    safe_name = name or filename.rsplit(".", 1)[0]
    destination = _safe_dest(settings.models_path, safe_name, ext)
    download_to_path(settings, bucket, key, str(destination))

    with destination.open("rb") as f:
        checksum = compute_checksum(f)
    size = destination.stat().st_size

    record = await create_model(
        db,
        owner_id=user_id,
        name=safe_name,
        framework=framework,
        task_type=task_type,
        description=description,
        filename=filename,
        path=str(destination),
        s3_uri=f"s3://{bucket}/{key}",
        size_bytes=size,
        checksum=checksum,
    )
    return ModelResponse.model_validate(record)


@router.get(
    "/models",
    response_model=list[ModelResponse],
    summary="Listar modelos",
)
async def list_models(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    from app.domain.audit.service import list_models

    records = await list_models(db, user_id)
    return [ModelResponse.model_validate(r) for r in records]


@router.delete(
    "/datasets/{dataset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar dataset",
)
async def delete_dataset_api(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
    settings: Settings = Depends(get_app_settings),
):
    record = await get_dataset(db, dataset_id, user_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    # Delete related analyses first to satisfy FK
    analyses = await list_analyses_by_dataset(db, dataset_id, user_id)
    from pathlib import Path

    for a in analyses:
        with contextlib.suppress(Exception):
            if a.report_path and not a.report_path.startswith("s3://"):
                Path(a.report_path).unlink(missing_ok=True)  # type: ignore[arg-type]
            if a.pdf_path and a.pdf_path.startswith("s3://") is False and a.pdf_path:
                Path(a.pdf_path).unlink(missing_ok=True)  # type: ignore[arg-type]
        if a.report_path and a.report_path.startswith("s3://"):
            with contextlib.suppress(Exception):
                delete_s3_uri(settings, a.report_path)
        if a.pdf_path and a.pdf_path.startswith("s3://"):
            with contextlib.suppress(Exception):
                delete_s3_uri(settings, a.pdf_path)
        await delete_analysis(db, a.id, user_id)
    # Delete local file
    with contextlib.suppress(Exception):
        Path(record.path).unlink(missing_ok=True)  # type: ignore[arg-type]
    # Delete S3 object if present
    if record.s3_uri:
        with contextlib.suppress(Exception):
            delete_s3_uri(settings, record.s3_uri)
    await delete_dataset(db, dataset_id, user_id)
    return {}


@router.delete(
    "/models/{model_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar modelo",
)
async def delete_model_api(
    model_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
    settings: Settings = Depends(get_app_settings),
):
    record = await get_model(db, model_id, user_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    analyses = await list_analyses_by_model(db, model_id, user_id)
    from pathlib import Path

    for a in analyses:
        with contextlib.suppress(Exception):
            if a.report_path and not a.report_path.startswith("s3://"):
                Path(a.report_path).unlink(missing_ok=True)  # type: ignore[arg-type]
            if a.pdf_path and a.pdf_path.startswith("s3://") is False and a.pdf_path:
                Path(a.pdf_path).unlink(missing_ok=True)  # type: ignore[arg-type]
        if a.report_path and a.report_path.startswith("s3://"):
            with contextlib.suppress(Exception):
                delete_s3_uri(settings, a.report_path)
        if a.pdf_path and a.pdf_path.startswith("s3://"):
            with contextlib.suppress(Exception):
                delete_s3_uri(settings, a.pdf_path)
        await delete_analysis(db, a.id, user_id)
    with contextlib.suppress(Exception):
        Path(record.path).unlink(missing_ok=True)  # type: ignore[arg-type]
    if record.s3_uri:
        with contextlib.suppress(Exception):
            delete_s3_uri(settings, record.s3_uri)
    await delete_model(db, model_id, user_id)
    return {}
