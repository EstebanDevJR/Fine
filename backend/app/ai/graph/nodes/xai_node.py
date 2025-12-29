from __future__ import annotations

from typing import TypedDict

from app.core.config import Settings
from app.services.xai_service import explain_model


class AuditGraphState(TypedDict, total=False):
    results: dict
    dataset: object
    model: object


def run_xai(state: AuditGraphState, settings: Settings) -> AuditGraphState:
    dataset, model = state["dataset"], state["model"]
    res = explain_model(dataset, model, settings.artifacts_path)
    results = state.get("results", {})
    results["xai"] = {
        "permutation_importance": res.permutation_importance,
        "shap_summary": res.shap_summary,
        "sample_size": res.sample_size,
        "artifact_path": str(res.artifact_path),
    }
    return {**state, "results": results}
