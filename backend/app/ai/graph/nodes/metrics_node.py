from __future__ import annotations

from typing import TypedDict

from app.core.config import Settings
from app.services.metrics_service import evaluate_model


class AuditGraphState(TypedDict, total=False):
    problem_type: str | None
    results: dict
    dataset: object
    model: object


def run_metrics(state: AuditGraphState, settings: Settings) -> AuditGraphState:
    dataset, model = state["dataset"], state["model"]
    res = evaluate_model(dataset, model, settings.artifacts_path)
    results = state.get("results", {})
    results["metrics"] = {
        "metrics": res.metrics,
        "n_samples": res.n_samples,
        "n_features": res.n_features,
        "n_classes": res.n_classes,
        "artifact_path": str(res.artifact_path),
    }
    return {**state, "results": results, "problem_type": res.problem_type}
