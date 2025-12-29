from __future__ import annotations

import pickle
from pathlib import Path

import joblib
from fastapi import HTTPException, status

from app.db.models import ModelArtifact

try:
    import torch
except ImportError:  # pragma: no cover
    torch = None


def load_model(artifact: ModelArtifact):
    path = Path(artifact.path)
    ext = path.suffix.lower().lstrip(".")

    if artifact.framework in {"sklearn", "xgboost"} or ext in {"pkl", "joblib"}:
        return joblib.load(path)

    if artifact.framework == "pytorch" or ext in {"pt", "pth", "bin"}:
        if torch is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="PyTorch no disponible en el entorno",
            )
        return torch.jit.load(path)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Framework/extension no soportado: {artifact.framework} ({ext})",
    )