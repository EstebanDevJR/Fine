from __future__ import annotations

from pathlib import Path
from typing import Tuple

import pandas as pd
from fastapi import HTTPException, status

from app.db.models import Dataset


def _read_dataset(path: Path, file_format: str) -> pd.DataFrame:
    if file_format == "csv":
        return pd.read_csv(path)
    if file_format == "parquet":
        return pd.read_parquet(path)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail=f"Formato no soportado: {file_format}"
    )


def load_dataset(dataset: Dataset) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
    """
    Load dataset, return (df, y, X).
    Raises HTTPException if target column missing.
    """
    df = _read_dataset(Path(dataset.path), dataset.file_format)
    if dataset.target_column not in df.columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Columna target '{dataset.target_column}' no encontrada en dataset",
        )
    y = df[dataset.target_column]
    X = df.drop(columns=[dataset.target_column])
    return df, y, X