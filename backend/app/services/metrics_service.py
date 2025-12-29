from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd
from fastapi import HTTPException, status
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_recall_curve,
    r2_score,
    roc_auc_score,
)

from app.db.models import Dataset, ModelArtifact
from app.services.dataset_loader import load_dataset
from app.services.model_loader import load_model

ProblemType = Literal["classification", "regression"]


@dataclass
class EvaluationResult:
    problem_type: ProblemType
    metrics: dict[str, Any]
    n_samples: int
    n_features: int
    n_classes: int | None
    artifact_path: Path


def _detect_problem_type(y: pd.Series) -> tuple[ProblemType, int | None]:
    if pd.api.types.is_numeric_dtype(y):
        # Heuristic: if few unique values and int, treat as classification
        unique_vals = y.dropna().unique()
        if y.dtype.kind in {"i", "b"} and len(unique_vals) <= 10:
            return "classification", len(unique_vals)
        return "regression", None
    # Non-numeric -> classification
    n_classes = y.dropna().nunique()
    return "classification", n_classes


def _classification_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_proba=None) -> dict[str, Any]:
    metrics: dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro")),
    }
    # Binary AUC/PR if probability available
    unique = np.unique(y_true[~pd.isna(y_true)])
    if y_proba is not None and len(unique) == 2:
        try:
            metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba[:, 1]))
            precision, recall, _ = precision_recall_curve(y_true, y_proba[:, 1])
            # approximate area under PR curve
            metrics["pr_auc"] = float(np.trapz(recall, precision))
        except Exception:
            metrics["roc_auc"] = None
            metrics["pr_auc"] = None
    else:
        metrics["roc_auc"] = None
        metrics["pr_auc"] = None
    return metrics


def _regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, Any]:
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    return {
        "rmse": rmse,
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "r2": float(r2_score(y_true, y_pred)),
    }


def _save_artifact(base: Path, data: dict[str, Any]) -> Path:
    base.mkdir(parents=True, exist_ok=True)
    path = base / f"metrics_{uuid.uuid4().hex}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return path


def _compute_permutation(model, X: pd.DataFrame, y: pd.Series, problem_type: str):
    scoring = "f1_macro" if problem_type == "classification" else "neg_mean_squared_error"
    result = permutation_importance(model, X, y, n_repeats=5, random_state=42, scoring=scoring)
    importance = []
    for name, mean_imp, std_imp in zip(
        X.columns, result.importances_mean, result.importances_std, strict=False
    ):
        importance.append(
            {"feature": name, "importance_mean": float(mean_imp), "importance_std": float(std_imp)}
        )
    importance.sort(key=lambda x: abs(x["importance_mean"]), reverse=True)
    return importance


def _align_features(X: pd.DataFrame, model_obj):
    """Align dataframe columns to model feature_names_in_ if present."""
    if hasattr(model_obj, "feature_names_in_"):
        needed = list(model_obj.feature_names_in_)
        missing = [c for c in needed if c not in X.columns]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing features required by model: {missing}",
            )
        return X[needed]
    return X


def evaluate_model(
    dataset: Dataset,
    model: ModelArtifact,
    storage_base: Path,
    exclude_columns: list[str] | None = None,
) -> EvaluationResult:
    import time

    from app.core.metrics import incr, observe_time

    start = time.perf_counter()
    df, y, X = load_dataset(dataset)
    if exclude_columns:
        X = X.drop(columns=exclude_columns, errors="ignore")
    problem_type, n_classes = _detect_problem_type(y)

    model_obj = load_model(model)
    X = _align_features(X, model_obj)

    if not hasattr(model_obj, "predict"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El modelo no tiene método predict",
        )

    y_pred = model_obj.predict(X)
    y_proba = None
    if problem_type == "classification" and hasattr(model_obj, "predict_proba"):
        try:
            y_proba = model_obj.predict_proba(X)
        except Exception:
            y_proba = None

    if problem_type == "classification":
        metrics = _classification_metrics(np.array(y), np.array(y_pred), y_proba)
    else:
        metrics = _regression_metrics(np.array(y), np.array(y_pred))

    artifact_data = {
        "dataset_id": dataset.id,
        "model_id": model.id,
        "problem_type": problem_type,
        "n_samples": int(len(df)),
        "n_features": int(X.shape[1]),
        "n_classes": int(n_classes) if n_classes is not None else None,
        "metrics": metrics,
        "created_at": datetime.utcnow().isoformat(),
    }

    artifact_path = _save_artifact(storage_base, artifact_data)
    observe_time("evaluate.ms", (time.perf_counter() - start) * 1000)
    incr("evaluate.calls", 1)
    return EvaluationResult(
        problem_type=problem_type,
        metrics=metrics,
        n_samples=int(len(df)),
        n_features=int(X.shape[1]),
        n_classes=int(n_classes) if n_classes is not None else None,
        artifact_path=artifact_path,
    )
