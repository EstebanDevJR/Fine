import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel


class Dataset(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: uuid.UUID
    name: str
    filename: str
    path: str
    s3_uri: str | None = None
    file_format: str
    size_bytes: int
    target_column: str
    checksum: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ModelArtifact(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: uuid.UUID
    name: str
    framework: str
    task_type: str | None = None
    filename: str
    path: str
    s3_uri: str | None = None
    size_bytes: int
    checksum: str
    description: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Analysis(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: uuid.UUID
    dataset_id: int
    model_id: int
    status: str = "created"  # created, running, completed, failed
    result_json: str | None = None
    report_path: str | None = None
    pdf_path: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
