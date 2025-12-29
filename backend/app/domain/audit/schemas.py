from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DatasetCreate(BaseModel):
    name: str | None = None
    target_column: str = Field(..., min_length=1)


class DatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    filename: str
    path: str
    s3_uri: str | None = None
    file_format: str
    size_bytes: int
    target_column: str
    checksum: str
    created_at: datetime


class ModelCreate(BaseModel):
    name: str | None = None
    framework: str = Field(..., description="sklearn | xgboost | pytorch | onnx")
    task_type: str | None = Field(None, description="classification | regression | other")
    description: str | None = None


class ModelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    framework: str
    task_type: str | None
    filename: str
    path: str
    s3_uri: str | None = None
    size_bytes: int
    checksum: str
    description: str | None
    created_at: datetime


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    dataset_id: int
    model_id: int
    report_path: str | None = None
    pdf_path: str | None = None
    result: dict | None = None
    created_at: datetime
