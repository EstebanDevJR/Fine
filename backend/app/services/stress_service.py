from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.db.models import Dataset, ModelArtifact
from app.services.dataset_loader import load_dataset
from app.services.metrics_service import _align_features, _compute_permutation, _detect_problem_type
from app.services.model_loader import load_model


@dataclass
class SensitivityResult:
    label_flip_rate: float | None
    proba_shift_mean: float | None
    artifact_path: Path


@dataclass
class RobustnessResult:
    metric_drop: float | None
    missing_feature_impact: dict
    artifact_path: Path


def _save_artifact(base: Path, data: dict[str, Any], prefix: str) -> Path:
    base.mkdir(parents=True, exist_ok=True)
    path = base / f"{prefix}_{uuid.uuid4().hex}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return path


def _noise_perturb(X: pd.DataFrame, noise_scale: float = 0.05) -> pd.DataFrame:
    X_noisy = X.copy()
    numeric_cols = X_noisy.select_dtypes(include=["number"]).columns
    for col in numeric_cols:
        std = X_noisy[col].std()
        eps = std * noise_scale if std > 0 else noise_scale
        X_noisy[col] = X_noisy[col] + np.random.normal(0, eps, size=len(X_noisy))
    return X_noisy


def sensitivity_analysis(
    dataset: Dataset,
    model_artifact: ModelArtifact,
    artifacts_path: Path,
    exclude_columns: list[str] | None = None,
    max_samples: int = 5000,
) -> SensitivityResult:
    import time

    from app.core.metrics import incr, observe_time

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
        raise ValueError("El modelo no tiene método predict")

    X_noisy = _noise_perturb(X)
    y_pred = model.predict(X)
    y_pred_noisy = model.predict(X_noisy)

    label_flip_rate = None
    proba_shift_mean = None

    if problem_type == "classification":
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(X)
            proba_noisy = model.predict_proba(X_noisy)
            proba_shift_mean = float(np.abs(proba_noisy - proba).mean())
        label_flip_rate = float(np.mean(y_pred_noisy != y_pred))
    else:
        # regression: measure relative delta
        proba_shift_mean = float(np.abs(y_pred_noisy - y_pred).mean())

    artifact = {
        "dataset_id": dataset.id,
        "model_id": model_artifact.id,
        "problem_type": problem_type,
        "label_flip_rate": label_flip_rate,
        "proba_shift_mean": proba_shift_mean,
    }
    artifact_path = _save_artifact(artifacts_path, artifact, prefix="sensitivity")

    elapsed_ms = (time.perf_counter() - start) * 1000
    observe_time("sensitivity.ms", elapsed_ms)
    incr("sensitivity.calls", 1)

    return SensitivityResult(
        label_flip_rate=label_flip_rate,
        proba_shift_mean=proba_shift_mean,
        artifact_path=artifact_path,
    )


def _mask_top_features(model, X: pd.DataFrame, top_features: list[str]) -> pd.DataFrame:
    X_masked = X.copy()
    for feat in top_features:
        if feat in X_masked.columns:
            X_masked[feat] = 0
    return X_masked


def _baseline_metric(model, X, y, problem_type: str) -> float:
    y_pred = model.predict(X)
    if problem_type == "classification":
        from sklearn.metrics import f1_score

        return float(f1_score(y, y_pred, average="macro"))
    else:
        from sklearn.metrics import mean_squared_error

        return -float(mean_squared_error(y, y_pred))  # negative MSE as utility


def robustness_analysis(
    dataset: Dataset,
    model_artifact: ModelArtifact,
    artifacts_path: Path,
    top_k: int = 2,
    noise_scale: float = 0.15,
    exclude_columns: list[str] | None = None,
    max_samples: int = 5000,
) -> RobustnessResult:
    import time

    from app.core.metrics import incr, observe_time

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

    base_metric = _baseline_metric(model, X, y, problem_type)

    # stronger noise test
    X_noisy = _noise_perturb(X, noise_scale=noise_scale)
    noisy_metric = _baseline_metric(model, X_noisy, y, problem_type)
    metric_drop = float(base_metric - noisy_metric)

    # masking top-k important features using permutation importance
    perm = _compute_permutation(model, X, y, problem_type)
    top_features = [item["feature"] for item in perm[:top_k]] if perm else []
    missing_impact = {}
    if top_features:
        X_masked = _mask_top_features(model, X, top_features)
        masked_metric = _baseline_metric(model, X_masked, y, problem_type)
        missing_impact = {
            "top_features": top_features,
            "metric_drop": float(base_metric - masked_metric),
        }

    artifact = {
        "dataset_id": dataset.id,
        "model_id": model_artifact.id,
        "problem_type": problem_type,
        "metric_drop": metric_drop,
        "missing_feature_impact": missing_impact,
    }
    artifact_path = _save_artifact(artifacts_path, artifact, prefix="robustness")

    elapsed_ms = (time.perf_counter() - start) * 1000
    observe_time("robustness.ms", elapsed_ms)
    incr("robustness.calls", 1)

    return RobustnessResult(
        metric_drop=metric_drop,
        missing_feature_impact=missing_impact,
        artifact_path=artifact_path,
    )
