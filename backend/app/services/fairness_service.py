from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List

import numpy as np
import pandas as pd
from fastapi import HTTPException, status

import time

from app.core.metrics import incr, observe_time
from app.db.models import Dataset, ModelArtifact
from app.services.dataset_loader import load_dataset
from app.services.model_loader import load_model
from app.services.metrics_service import _align_features


@dataclass
class FairnessResult:
    demographic_parity_diff: float | None
    disparate_impact: float | None
    equal_opportunity_diff: float | None
    predictive_equality_diff: float | None
    artifact_path: Path


def _save_artifact(base: Path, data: Dict[str, Any]) -> Path:
    base.mkdir(parents=True, exist_ok=True)
    path = base / f"fairness_{uuid.uuid4().hex}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return path


def _ensure_binary(y: pd.Series) -> np.ndarray:
    unique = y.dropna().unique()
    if len(unique) > 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fairness básico requiere target binario (máx 2 clases)",
        )
    # map to 0/1
    if set(unique) <= {0, 1}:
        return y.to_numpy()
    mapping = {val: i for i, val in enumerate(sorted(unique))}
    return y.map(mapping).to_numpy()


def _mask_group(sensitive: pd.Series, values: Iterable) -> np.ndarray:
    return sensitive.isin(list(values)).to_numpy()


def _rates(y_true: np.ndarray, y_pred: np.ndarray, mask: np.ndarray):
    if mask.sum() == 0:
        return None, None, None
    yt = y_true[mask]
    yp = y_pred[mask]
    tp = np.logical_and(yt == 1, yp == 1).sum()
    fn = np.logical_and(yt == 1, yp == 0).sum()
    fp = np.logical_and(yt == 0, yp == 1).sum()
    tn = np.logical_and(yt == 0, yp == 0).sum()
    tpr = tp / (tp + fn) if (tp + fn) > 0 else None
    fpr = fp / (fp + tn) if (fp + tn) > 0 else None
    positive_rate = yp.mean() if len(yp) > 0 else None
    return tpr, fpr, positive_rate


def evaluate_fairness(
    dataset: Dataset,
    model_artifact: ModelArtifact,
    artifacts_path: Path,
    sensitive_attribute: str,
    privileged_values: List[Any],
    unprivileged_values: List[Any],
    positive_label: int | float | str = 1,
) -> FairnessResult:
    df, y, X = load_dataset(dataset)

    if sensitive_attribute not in df.columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Atributo sensible '{sensitive_attribute}' no existe en el dataset",
        )

    start = time.perf_counter()
    sensitive = df[sensitive_attribute]
    model = load_model(model_artifact)

    if not hasattr(model, "predict"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="El modelo no tiene método predict"
        )

    # Do not pass the sensitive attribute into the model if present
    X_for_model = X.drop(columns=[sensitive_attribute], errors="ignore")
    X_for_model = _align_features(X_for_model, model)

    y_true = _ensure_binary(y)
    y_pred_raw = model.predict(X_for_model)
    y_pred = np.array([1 if v == positive_label else 0 for v in y_pred_raw])

    priv_mask = _mask_group(sensitive, privileged_values)
    unpriv_mask = _mask_group(sensitive, unprivileged_values)

    tpr_priv, fpr_priv, pr_priv = _rates(y_true, y_pred, priv_mask)
    tpr_unpriv, fpr_unpriv, pr_unpriv = _rates(y_true, y_pred, unpriv_mask)

    demographic_parity_diff = None
    disparate_impact = None
    equal_opportunity_diff = None
    predictive_equality_diff = None

    if pr_priv is not None and pr_unpriv is not None:
        demographic_parity_diff = float(pr_unpriv - pr_priv)
        disparate_impact = float(pr_unpriv / pr_priv) if pr_priv > 0 else None

    if tpr_priv is not None and tpr_unpriv is not None:
        equal_opportunity_diff = float(tpr_unpriv - tpr_priv)

    if fpr_priv is not None and fpr_unpriv is not None:
        predictive_equality_diff = float(fpr_unpriv - fpr_priv)

    artifact = {
        "dataset_id": dataset.id,
        "model_id": model_artifact.id,
        "sensitive_attribute": sensitive_attribute,
        "privileged_values": privileged_values,
        "unprivileged_values": unprivileged_values,
        "demographic_parity_diff": demographic_parity_diff,
        "disparate_impact": disparate_impact,
        "equal_opportunity_diff": equal_opportunity_diff,
        "predictive_equality_diff": predictive_equality_diff,
    }

    artifact_path = _save_artifact(artifacts_path, artifact)

    elapsed_ms = (time.perf_counter() - start) * 1000
    observe_time("fairness.ms", elapsed_ms)
    incr("fairness.calls", 1)

    return FairnessResult(
        demographic_parity_diff=demographic_parity_diff,
        disparate_impact=disparate_impact,
        equal_opportunity_diff=equal_opportunity_diff,
        predictive_equality_diff=predictive_equality_diff,
        artifact_path=artifact_path,
    )