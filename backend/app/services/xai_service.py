from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import shap
from fastapi import HTTPException, status

from app.core.metrics import incr, observe_time
from app.db.models import Dataset, ModelArtifact
from app.services.dataset_loader import load_dataset
from app.services.metrics_service import _align_features, _compute_permutation, _detect_problem_type
from app.services.model_loader import load_model


@dataclass
class XAIResult:
    problem_type: str
    permutation_importance: list[dict[str, Any]]
    shap_summary: dict[str, Any]
    sample_size: int
    artifact_path: Path


def _save_artifact(base: Path, data: dict[str, Any]) -> Path:
    base.mkdir(parents=True, exist_ok=True)
    path = base / f"xai_{uuid.uuid4().hex}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return path


def _compute_shap(model, X: pd.DataFrame):
    sample = X
    if len(X) > 200:
        sample = X.sample(200, random_state=42)
    explainer = shap.Explainer(model, sample)
    shap_values = explainer(sample)

    def _mean_abs(values: np.ndarray) -> list[float]:
        return np.abs(values).mean(axis=0).tolist()

    if isinstance(shap_values.values, list):
        per_class = []
        for cls_idx, cls_vals in enumerate(shap_values.values):
            per_class.append(
                {
                    "class": cls_idx,
                    "mean_abs": _mean_abs(np.array(cls_vals)),
                }
            )
        aggregated = np.mean([np.abs(np.array(v)).mean(axis=0) for v in shap_values.values], axis=0)
        summary = {
            "per_class": per_class,
            "global_mean_abs": aggregated.tolist(),
            "feature_names": shap_values.feature_names,
        }
    else:
        summary = {
            "global_mean_abs": _mean_abs(np.array(shap_values.values)),
            "feature_names": shap_values.feature_names,
        }
    return summary


def explain_model(
    dataset: Dataset,
    model_artifact: ModelArtifact,
    artifacts_path: Path,
    exclude_columns: list[str] | None = None,
    max_samples: int = 5000,
) -> XAIResult:
    start = time.perf_counter()
    df, y, X = load_dataset(dataset)
    if len(df) > max_samples:
        df = df.sample(max_samples, random_state=42)
        y = df[dataset.target_column]
        X = df.drop(columns=[dataset.target_column])
    if exclude_columns:
        X = X.drop(columns=exclude_columns, errors="ignore")
    problem_type, _ = _detect_problem_type(y)
    model = load_model(model_artifact)
    X = _align_features(X, model)

    if not hasattr(model, "predict"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="El modelo no tiene método predict"
        )

    perm = _compute_permutation(model, X, y, problem_type)
    shap_summary = _compute_shap(model, X)

    artifact = {
        "dataset_id": dataset.id,
        "model_id": model_artifact.id,
        "problem_type": problem_type,
        "sample_size": int(len(df)),
        "n_features": int(X.shape[1]),
        "permutation_importance": perm,
        "shap_summary": shap_summary,
    }
    artifact_path = _save_artifact(artifacts_path, artifact)
    elapsed_ms = (time.perf_counter() - start) * 1000
    observe_time("xai.ms", elapsed_ms)
    incr("xai.calls", 1)

    return XAIResult(
        problem_type=problem_type,
        permutation_importance=perm,
        shap_summary=shap_summary,
        sample_size=int(len(df)),
        artifact_path=artifact_path,
    )
