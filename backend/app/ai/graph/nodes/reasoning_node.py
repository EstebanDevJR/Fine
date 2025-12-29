from __future__ import annotations

from typing import TypedDict

from app.core.config import Settings
from app.services.diagnose_service import diagnose


class AuditGraphState(TypedDict, total=False):
    results: dict
    dataset: object
    model: object
    sensitive_attribute: str | None
    privileged_values: list
    unprivileged_values: list
    positive_label: int | float | str


def run_reasoning(state: AuditGraphState, settings: Settings) -> AuditGraphState:
    dataset, model = state["dataset"], state["model"]
    res = diagnose(
        dataset=dataset,
        model=model,
        settings=settings,
        sensitive_attribute=state.get("sensitive_attribute"),
        privileged_values=state.get("privileged_values"),
        unprivileged_values=state.get("unprivileged_values"),
        positive_label=state.get("positive_label", 1),
    )
    results = state.get("results", {})
    results["diagnose"] = {
        "summary": res.summary,
        "risks": res.risks,
        "recommendations": res.recommendations,
        "artifact_path": str(res.artifact_path),
    }
    return {**state, "results": results}
