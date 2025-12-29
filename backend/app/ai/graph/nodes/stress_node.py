from __future__ import annotations

from typing import TypedDict

from app.core.config import Settings
from app.services.stress_service import robustness_analysis, sensitivity_analysis


class AuditGraphState(TypedDict, total=False):
    results: dict
    dataset: object
    model: object


def run_stress(state: AuditGraphState, settings: Settings) -> AuditGraphState:
    dataset, model = state["dataset"], state["model"]

    sens_res = sensitivity_analysis(dataset, model, settings.artifacts_path)
    rob_res = robustness_analysis(dataset, model, settings.artifacts_path)

    results = state.get("results", {})
    results["sensitivity"] = {
        "label_flip_rate": sens_res.label_flip_rate,
        "proba_shift_mean": sens_res.proba_shift_mean,
        "artifact_path": str(sens_res.artifact_path),
    }
    results["robustness"] = {
        "metric_drop": rob_res.metric_drop,
        "missing_feature_impact": rob_res.missing_feature_impact,
        "artifact_path": str(rob_res.artifact_path),
    }
    return {**state, "results": results}
