from __future__ import annotations

from typing import TypedDict

from app.core.config import Settings
from app.services.fairness_service import evaluate_fairness


class AuditGraphState(TypedDict, total=False):
    results: dict
    dataset: object
    model: object
    sensitive_attribute: str | None
    privileged_values: list
    unprivileged_values: list
    positive_label: int | float | str


def run_fairness(state: AuditGraphState, settings: Settings) -> AuditGraphState:
    results = state.get("results", {})
    if not state.get("sensitive_attribute"):
        results["fairness"] = {"skipped": True, "reason": "No sensitive attribute provided"}
        return {**state, "results": results}

    dataset, model = state["dataset"], state["model"]
    res = evaluate_fairness(
        dataset=dataset,
        model_artifact=model,
        artifacts_path=settings.artifacts_path,
        sensitive_attribute=state.get("sensitive_attribute"),
        privileged_values=state.get("privileged_values") or [],
        unprivileged_values=state.get("unprivileged_values") or [],
        positive_label=state.get("positive_label", 1),
    )
    results["fairness"] = {
        "demographic_parity_diff": res.demographic_parity_diff,
        "disparate_impact": res.disparate_impact,
        "equal_opportunity_diff": res.equal_opportunity_diff,
        "predictive_equality_diff": res.predictive_equality_diff,
        "artifact_path": str(res.artifact_path),
    }
    return {**state, "results": results}
