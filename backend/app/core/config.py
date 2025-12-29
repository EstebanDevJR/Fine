from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="allow",
    )

    app_name: str = "Fine Audit Backend"
    app_env: Literal["local", "dev", "prod"] = "local"
    secret_key: str = "change-me"
    log_level: str = Field(default="INFO", description="Python log level")

    database_url: str = "sqlite+aiosqlite:///./data/app.db"
    data_path: Path = Path("./data").resolve()
    redis_url: str = "redis://redis:6379/0"

    openai_api_key: str | None = None
    openai_api_base: HttpUrl | None = None
    openai_model: str = "gpt-4o-mini"

    # Supabase Auth
    supabase_url: HttpUrl | None = None
    supabase_jwks_url: HttpUrl | None = None
    supabase_anon_key: str | None = None
    supabase_jwt_secret: str | None = None
    supabase_service_role_key: str | None = None

    # AWS / S3 storage
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str | None = None
    s3_bucket_datasets: str | None = None
    s3_bucket_models: str | None = None
    s3_bucket_reports: str | None = None
    s3_bucket_artifacts: str | None = None
    s3_presign_exp_seconds: int = 900

    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_host: str | None = None

    storage_base_path: Path = Path("./app/storage").resolve()
    reports_path: Path = storage_base_path / "reports"
    models_path: Path = storage_base_path / "models"
    datasets_path: Path = storage_base_path / "datasets"
    artifacts_path: Path = storage_base_path / "artifacts"
    enable_rate_limit: bool = False
    rate_limit_per_minute: int = 20
    rate_limit_burst: int = 30
    auto_create_db: bool = True

    # CORS
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        description="Comma-separated list of allowed CORS origins",
    )
    cors_allow_credentials: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [o.strip() for o in (self.cors_origins or "").split(",")]
        return [o for o in origins if o]

    @property
    def is_debug(self) -> bool:
        return self.app_env == "local"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
