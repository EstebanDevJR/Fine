"""Advanced metrics for model evaluation: calibration, confidence intervals, adversarial robustness."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.metrics import brier_score_loss

from app.db.models import Dataset, ModelArtifact
from app.services.dataset_loader import load_dataset
from app.services.metrics_service import _align_features, _detect_problem_type
from app.services.model_loader import load_model


@dataclass
class AdvancedMetricsResult:
    """Results from advanced metrics evaluation."""

    calibration_error: float | None
    brier_score: float | None
    confidence_intervals: dict[str, tuple[float, float]] | None
    adversarial_robustness: dict[str, float] | None
    artifact_path: Path


def _save_artifact(base: Path, data: dict[str, Any]) -> Path:
    """Save artifact to disk."""
    base.mkdir(parents=True, exist_ok=True)
    path = base / f"advanced_metrics_{uuid.uuid4().hex}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return path


def _compute_calibration(
    y_true: np.ndarray, y_proba: np.ndarray, n_bins: int = 10
) -> tuple[float, float]:
    """Compute calibration error and Brier score."""
    if len(y_true) == 0 or y_proba is None or len(y_proba.shape) < 2:
        return None, None

    # For binary classification, use positive class probabilities
    proba_pos = y_proba[:, 1] if y_proba.shape[1] == 2 else np.max(y_proba, axis=1)

    try:
        fraction_of_positives, mean_predicted_value = calibration_curve(
            y_true, proba_pos, n_bins=n_bins, strategy="uniform"
        )
        # Expected Calibration Error (ECE)
        ece = np.mean(np.abs(fraction_of_positives - mean_predicted_value))
        brier = float(brier_score_loss(y_true, proba_pos))
        return float(ece), brier
    except Exception:
        return None, None


def _compute_confidence_intervals(
    y_true: np.ndarray, y_pred: np.ndarray, y_proba: np.ndarray | None = None
) -> dict[str, tuple[float, float]] | None:
    """Compute bootstrap confidence intervals for key metrics."""
    if len(y_true) < 100:  # Need sufficient samples for bootstrap
        return None

    n_bootstrap = 1000
    n_samples = len(y_true)
    rng = np.random.RandomState(42)

    metrics_bootstrap = []
    for _ in range(n_bootstrap):
        indices = rng.choice(n_samples, size=n_samples, replace=True)
        y_true_boot = y_true[indices]
        y_pred_boot = y_pred[indices]

        # Simple accuracy for classification, RMSE for regression
        if np.issubdtype(y_true.dtype, np.integer) or len(np.unique(y_true)) < 10:
            metric = float(np.mean(y_true_boot == y_pred_boot))
        else:
            metric = float(np.sqrt(np.mean((y_true_boot - y_pred_boot) ** 2)))

        metrics_bootstrap.append(metric)

    if not metrics_bootstrap:
        return None

    ci_lower = float(np.percentile(metrics_bootstrap, 2.5))
    ci_upper = float(np.percentile(metrics_bootstrap, 97.5))
    return {"main_metric": (ci_lower, ci_upper)}


def _compute_adversarial_robustness(
    model, X: pd.DataFrame, y: pd.Series, problem_type: str, epsilon: float = 0.01
) -> dict[str, float] | None:
    """Compute adversarial robustness using FGSM-like perturbations."""
    if problem_type != "classification":
        return None

    try:
        y_pred_orig = model.predict(X)
        accuracy_orig = float(np.mean(y == y_pred_orig))

        # Simple adversarial perturbation: add small noise to features
        X_perturbed = X.copy()
        for col in X.columns:
            if pd.api.types.is_numeric_dtype(X[col]):
                noise = np.random.RandomState(42).normal(0, epsilon * X[col].std(), size=len(X))
                X_perturbed[col] = X[col] + noise

        y_pred_pert = model.predict(X_perturbed)
        accuracy_pert = float(np.mean(y == y_pred_pert))

        robustness_score = accuracy_pert / accuracy_orig if accuracy_orig > 0 else 0.0
        accuracy_drop = accuracy_orig - accuracy_pert

        return {
            "robustness_score": float(robustness_score),
            "accuracy_drop": float(accuracy_drop),
            "original_accuracy": accuracy_orig,
            "perturbed_accuracy": accuracy_pert,
        }
    except Exception:
        return None


def evaluate_advanced_metrics(
    dataset: Dataset,
    model: ModelArtifact,
    artifacts_path: Path,
    exclude_columns: list[str] | None = None,
) -> AdvancedMetricsResult:
    """Evaluate advanced metrics: calibration, confidence intervals, adversarial robustness."""
    df, y, X = load_dataset(dataset)
    if exclude_columns:
        X = X.drop(columns=exclude_columns, errors="ignore")

    problem_type, _ = _detect_problem_type(y)
    model_obj = load_model(model)
    X = _align_features(X, model_obj)

    y_pred = model_obj.predict(X)
    y_proba = None
    if hasattr(model_obj, "predict_proba"):
        try:
            y_proba = model_obj.predict_proba(X)
        except Exception:
            y_proba = None

    calibration_error = None
    brier_score = None
    if problem_type == "classification" and y_proba is not None:
        y_true_binary = np.array([1 if v == np.unique(y)[1] else 0 for v in y]) if len(np.unique(y)) == 2 else y
        calibration_error, brier_score = _compute_calibration(y_true_binary, y_proba)

    confidence_intervals = _compute_confidence_intervals(np.array(y), np.array(y_pred), y_proba)

    adversarial_robustness = _compute_adversarial_robustness(model_obj, X, y, problem_type)

    artifact_data = {
        "dataset_id": dataset.id,
        "model_id": model.id,
        "problem_type": problem_type,
        "calibration_error": calibration_error,
        "brier_score": brier_score,
        "confidence_intervals": confidence_intervals,
        "adversarial_robustness": adversarial_robustness,
    }

    artifact_path = _save_artifact(artifacts_path, artifact_data)

    return AdvancedMetricsResult(
        calibration_error=calibration_error,
        brier_score=brier_score,
        confidence_intervals=confidence_intervals,
        adversarial_robustness=adversarial_robustness,
        artifact_path=artifact_path,
    )

