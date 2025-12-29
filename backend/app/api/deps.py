from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.session import get_session


def get_app_settings() -> Settings:
    return get_settings()


async def get_db() -> AsyncIterator[AsyncSession]:
    async for session in get_session():
        yield session