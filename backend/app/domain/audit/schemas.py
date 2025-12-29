from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DatasetCreate(BaseModel):
    name: Optional[str] = None
    target_column: str = Field(..., min_length=1)


class DatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    filename: str
    path: str
    s3_uri: Optional[str] = None
    file_format: str
    size_bytes: int
    target_column: str
    checksum: str
    created_at: datetime


class ModelCreate(BaseModel):
    name: Optional[str] = None
    framework: str = Field(..., description="sklearn | xgboost | pytorch | onnx")
    task_type: Optional[str] = Field(None, description="classification | regression | other")
    description: Optional[str] = None


class ModelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    framework: str
    task_type: Optional[str]
    filename: str
    path: str
    s3_uri: Optional[str] = None
    size_bytes: int
    checksum: str
    description: Optional[str]
    created_at: datetime


class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    dataset_id: int
    model_id: int
    report_path: Optional[str] = None
    pdf_path: Optional[str] = None
    result: Optional[dict] = None
    created_at: datetime

