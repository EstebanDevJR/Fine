from __future__ import annotations

import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import Dataset, ModelArtifact


async def create_dataset(
    db: AsyncSession,
    *,
    owner_id: str,
    name: str,
    filename: str,
    path: str,
    s3_uri: str | None,
    file_format: str,
    size_bytes: int,
    target_column: str,
    checksum: str,
) -> Dataset:
    owner_uuid = uuid.UUID(owner_id)
    record = Dataset(
        owner_id=owner_uuid,
        name=name,
        filename=filename,
        path=path,
        s3_uri=s3_uri,
        file_format=file_format,
        size_bytes=size_bytes,
        target_column=target_column,
        checksum=checksum,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def create_model(
    db: AsyncSession,
    *,
    owner_id: str,
    name: str,
    framework: str,
    task_type: str | None,
    description: str | None,
    filename: str,
    path: str,
    s3_uri: str | None,
    size_bytes: int,
    checksum: str,
) -> ModelArtifact:
    owner_uuid = uuid.UUID(owner_id)
    record = ModelArtifact(
        owner_id=owner_uuid,
        name=name,
        framework=framework,
        task_type=task_type,
        description=description,
        filename=filename,
        path=path,
        s3_uri=s3_uri,
        size_bytes=size_bytes,
        checksum=checksum,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def list_datasets(db: AsyncSession, owner_id: str) -> list[Dataset]:
    owner_uuid = uuid.UUID(owner_id)
    result = await db.exec(
        select(Dataset).where(Dataset.owner_id == owner_uuid).order_by(Dataset.created_at.desc())
    )
    return result.all()


async def list_models(db: AsyncSession, owner_id: str) -> list[ModelArtifact]:
    owner_uuid = uuid.UUID(owner_id)
    result = await db.exec(
        select(ModelArtifact)
        .where(ModelArtifact.owner_id == owner_uuid)
        .order_by(ModelArtifact.created_at.desc())
    )
    return result.all()


# use case orchestration
