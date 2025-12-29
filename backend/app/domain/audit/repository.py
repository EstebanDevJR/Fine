from __future__ import annotations

from typing import Optional
import uuid

from sqlmodel import select, delete
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import Analysis, Dataset, ModelArtifact


async def get_dataset(db: AsyncSession, dataset_id: int, owner_id: str) -> Optional[Dataset]:
    owner_uuid = uuid.UUID(owner_id)
    res = await db.exec(select(Dataset).where(Dataset.id == dataset_id, Dataset.owner_id == owner_uuid))
    return res.first()


async def get_model(db: AsyncSession, model_id: int, owner_id: str) -> Optional[ModelArtifact]:
    owner_uuid = uuid.UUID(owner_id)
    res = await db.exec(select(ModelArtifact).where(ModelArtifact.id == model_id, ModelArtifact.owner_id == owner_uuid))
    return res.first()


async def create_analysis(
    db: AsyncSession,
    owner_id: str,
    dataset_id: int,
    model_id: int,
    status: str,
    result_json: Optional[str] = None,
    report_path: Optional[str] = None,
    pdf_path: Optional[str] = None,
) -> Analysis:
    owner_uuid = uuid.UUID(owner_id)
    analysis = Analysis(
        owner_id=owner_uuid,
        dataset_id=dataset_id,
        model_id=model_id,
        status=status,
        result_json=result_json,
        report_path=report_path,
        pdf_path=pdf_path,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    return analysis


async def list_analyses(db: AsyncSession, owner_id: str) -> list[Analysis]:
    owner_uuid = uuid.UUID(owner_id)
    res = await db.exec(select(Analysis).where(Analysis.owner_id == owner_uuid).order_by(Analysis.created_at.desc()))
    return res.all()


async def get_analysis(db: AsyncSession, analysis_id: int, owner_id: str) -> Optional[Analysis]:
    owner_uuid = uuid.UUID(owner_id)
    res = await db.exec(select(Analysis).where(Analysis.id == analysis_id, Analysis.owner_id == owner_uuid))
    return res.first()


async def list_analyses_by_dataset(db: AsyncSession, dataset_id: int, owner_id: str) -> list[Analysis]:
    owner_uuid = uuid.UUID(owner_id)
    res = await db.exec(select(Analysis).where(Analysis.dataset_id == dataset_id, Analysis.owner_id == owner_uuid))
    return res.all()


async def list_analyses_by_model(db: AsyncSession, model_id: int, owner_id: str) -> list[Analysis]:
    owner_uuid = uuid.UUID(owner_id)
    res = await db.exec(select(Analysis).where(Analysis.model_id == model_id, Analysis.owner_id == owner_uuid))
    return res.all()


async def delete_dataset(db: AsyncSession, dataset_id: int, owner_id: str) -> bool:
    owner_uuid = uuid.UUID(owner_id)
    stmt = delete(Dataset).where(Dataset.id == dataset_id, Dataset.owner_id == owner_uuid)
    res = await db.exec(stmt)
    await db.commit()
    return res.rowcount > 0


async def delete_model(db: AsyncSession, model_id: int, owner_id: str) -> bool:
    owner_uuid = uuid.UUID(owner_id)
    stmt = delete(ModelArtifact).where(ModelArtifact.id == model_id, ModelArtifact.owner_id == owner_uuid)
    res = await db.exec(stmt)
    await db.commit()
    return res.rowcount > 0


async def delete_analysis(db: AsyncSession, analysis_id: int, owner_id: str) -> bool:
    owner_uuid = uuid.UUID(owner_id)
    stmt = delete(Analysis).where(Analysis.id == analysis_id, Analysis.owner_id == owner_uuid)
    res = await db.exec(stmt)
    await db.commit()
    return res.rowcount > 0
# state persistence