from __future__ import annotations

from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from app.core.config import Settings, get_settings
from app.db.session import AsyncSessionLocal
from app.domain.audit.repository import get_dataset, get_model
from app.services.diagnose_service import diagnose
from app.services.fairness_service import evaluate_fairness
from app.services.metrics_service import evaluate_model
from app.services.report_service import generate_report
from app.services.stress_service import robustness_analysis, sensitivity_analysis
from app.services.xai_service import explain_model


class AuditGraphState(TypedDict, total=False):
    dataset_id: int
    model_id: int
    sensitive_attribute: str | None
    privileged_values: list
    unprivileged_values: list
    positive_label: int | float | str
    dataset: Any
    model: Any
    problem_type: str | None
    results: dict
    error: str


def build_audit_graph(settings: Settings | None = None):
    """Define the LangGraph for the audit pipeline. Returns a compiled graph ready to invoke."""
    settings = settings or get_settings()
    graph = StateGraph(AuditGraphState)

    async def load_inputs(state: AuditGraphState) -> AuditGraphState:
        async with AsyncSessionLocal() as db:
            dataset = await get_dataset(db, state["dataset_id"])
            model = await get_model(db, state["model_id"])
            if not dataset or not model:
                raise ValueError("Dataset or model not found")
        return {**state, "dataset": dataset, "model": model, "results": {}, "problem_type": None}

    def run_evaluate(state: AuditGraphState) -> AuditGraphState:
        dataset, model = state["dataset"], state["model"]
        res = evaluate_model(dataset, model, settings.artifacts_path)
        results = state.get("results", {})
        results["evaluate"] = {
            "metrics": res.metrics,
            "n_samples": res.n_samples,
            "n_features": res.n_features,
            "n_classes": res.n_classes,
            "artifact_path": str(res.artifact_path),
        }
        return {**state, "results": results, "problem_type": res.problem_type}

    def run_xai(state: AuditGraphState) -> AuditGraphState:
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

    def run_sensitivity(state: AuditGraphState) -> AuditGraphState:
        dataset, model = state["dataset"], state["model"]
        res = sensitivity_analysis(dataset, model, settings.artifacts_path)
        results = state.get("results", {})
        results["sensitivity"] = {
            "label_flip_rate": res.label_flip_rate,
            "proba_shift_mean": res.proba_shift_mean,
            "artifact_path": str(res.artifact_path),
        }
        return {**state, "results": results}

    def run_robustness(state: AuditGraphState) -> AuditGraphState:
        dataset, model = state["dataset"], state["model"]
        res = robustness_analysis(dataset, model, settings.artifacts_path)
        results = state.get("results", {})
        results["robustness"] = {
            "metric_drop": res.metric_drop,
            "missing_feature_impact": res.missing_feature_impact,
            "artifact_path": str(res.artifact_path),
        }
        return {**state, "results": results}

    def run_fairness(state: AuditGraphState) -> AuditGraphState:
        if not state.get("sensitive_attribute"):
            results = state.get("results", {})
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
        results = state.get("results", {})
        results["fairness"] = {
            "demographic_parity_diff": res.demographic_parity_diff,
            "disparate_impact": res.disparate_impact,
            "equal_opportunity_diff": res.equal_opportunity_diff,
            "predictive_equality_diff": res.predictive_equality_diff,
            "artifact_path": str(res.artifact_path),
        }
        return {**state, "results": results}

    def run_diagnose(state: AuditGraphState) -> AuditGraphState:
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

    def run_report(state: AuditGraphState) -> AuditGraphState:
        dataset, model = state["dataset"], state["model"]
        res = generate_report(
            dataset=dataset,
            model=model,
            settings=settings,
            sensitive_attribute=state.get("sensitive_attribute"),
            privileged_values=state.get("privileged_values"),
            unprivileged_values=state.get("unprivileged_values"),
            positive_label=state.get("positive_label", 1),
        )
        results = state.get("results", {})
        results["report"] = {
            "txt_path": str(res.txt_path),
        }
        return {**state, "results": results}

    graph.add_node("load", load_inputs)
    graph.add_node("evaluate", run_evaluate)
    graph.add_node("xai", run_xai)
    graph.add_node("sensitivity", run_sensitivity)
    graph.add_node("robustness", run_robustness)
    graph.add_node("fairness", run_fairness)
    graph.add_node("diagnose", run_diagnose)
    graph.add_node("report", run_report)

    graph.set_entry_point("load")
    graph.add_edge("load", "evaluate")
    graph.add_edge("evaluate", "xai")
    graph.add_edge("xai", "sensitivity")
    graph.add_edge("sensitivity", "robustness")
    graph.add_edge("robustness", "fairness")
    graph.add_edge("fairness", "diagnose")
    graph.add_edge("diagnose", "report")
    graph.add_edge("report", END)

    return graph.compile()


async def run_audit_graph(
    payload: AuditGraphState, settings: Settings | None = None
) -> AuditGraphState:
    compiled = build_audit_graph(settings=settings)
    return await compiled.ainvoke(payload)
