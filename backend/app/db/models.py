from datetime import datetime
from typing import Optional
import uuid

from sqlmodel import Field, SQLModel


class Dataset(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: uuid.UUID
    name: str
    filename: str
    path: str
    s3_uri: Optional[str] = None
    file_format: str
    size_bytes: int
    target_column: str
    checksum: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ModelArtifact(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: uuid.UUID
    name: str
    framework: str
    task_type: Optional[str] = None
    filename: str
    path: str
    s3_uri: Optional[str] = None
    size_bytes: int
    checksum: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Analysis(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: uuid.UUID
    dataset_id: int
    model_id: int
    status: str = "created"  # created, running, completed, failed
    result_json: Optional[str] = None
    report_path: Optional[str] = None
    pdf_path: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

