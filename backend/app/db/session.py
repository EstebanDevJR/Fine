from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import get_settings
from app.db import base  # noqa: F401  # register models

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.is_debug,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    # For production deployments, prefer Alembic migrations.
    # In local/dev, auto-create is convenient for bootstrapping.
    if not settings.auto_create_db:
        return
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

