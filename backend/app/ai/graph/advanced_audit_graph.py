"""Advanced LangGraph-based audit pipeline with specialized agents, conditional routing, and checkpoints."""

from __future__ import annotations

from typing import Any, TypedDict

import numpy as np
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from app.ai.agents.fairness_agent import FairnessAgent
from app.ai.agents.metrics_agent import MetricsAgent
from app.ai.agents.xai_agent import XAIAgent
from app.core.config import Settings, get_settings
from app.core.tracing import TraceWrapper, build_trace
from app.db.session import AsyncSessionLocal
from app.domain.audit.repository import get_dataset, get_model
from app.services.advanced_metrics_service import evaluate_advanced_metrics
from app.services.fairness_service import evaluate_fairness
from app.services.metrics_service import evaluate_model
from app.services.report_service import generate_report
from app.services.stress_service import robustness_analysis, sensitivity_analysis
from app.services.xai_service import explain_model


class AdvancedAuditGraphState(TypedDict, total=False):
    """State for the advanced audit graph with agent reasoning."""

    dataset_id: int
    model_id: int
    owner_id: str
    sensitive_attribute: str | None
    privileged_values: list
    unprivileged_values: list
    positive_label: int | float | str
    dataset: Any
    model: Any
    problem_type: str | None
    results: dict[str, Any]
    agent_insights: dict[str, Any]  # Insights from specialized agents
    error: str
    should_run_advanced: bool  # Flag for conditional routing
    should_run_fairness: bool  # Flag for conditional routing


def build_advanced_audit_graph(
    settings: Settings | None = None,
    trace: TraceWrapper | None = None,
    trace_input: dict | None = None,
    enable_checkpoints: bool = True,
) -> StateGraph:
    """Build advanced audit graph with agents, conditional routing, and checkpoints."""
    settings = settings or get_settings()
    trace = trace or build_trace(settings, name="advanced_audit_graph", input=trace_input)

    # Initialize agents
    metrics_agent = MetricsAgent(settings)
    xai_agent = XAIAgent(settings)
    fairness_agent = FairnessAgent(settings)

    graph = StateGraph(AdvancedAuditGraphState)

    # Checkpoint storage for recovery
    checkpointer = MemorySaver() if enable_checkpoints else None

    async def load_inputs(state: AdvancedAuditGraphState) -> AdvancedAuditGraphState:
        """Load dataset and model from database."""
        owner_id = state.get("owner_id")
        async with AsyncSessionLocal() as db:
            dataset = await get_dataset(db, state["dataset_id"], owner_id) if owner_id else None
            model = await get_model(db, state["model_id"], owner_id) if owner_id else None
            if not dataset or not model:
                raise ValueError("Dataset or model not found")
        return {
            **state,
            "dataset": dataset,
            "model": model,
            "results": {},
            "agent_insights": {},
            "problem_type": None,
            "should_run_advanced": True,
            "should_run_fairness": bool(state.get("sensitive_attribute")),
        }

    def run_metrics(state: AdvancedAuditGraphState) -> AdvancedAuditGraphState:
        """Run basic metrics evaluation."""
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

        # Agent analysis
        try:
            agent_response = metrics_agent.analyze(
                {
                    "metrics": res.metrics,
                    "problem_type": res.problem_type,
                    "n_samples": res.n_samples,
                    "n_features": res.n_features,
                    "n_classes": res.n_classes,
                }
            )
            agent_insights = state.get("agent_insights", {})
            agent_insights["metrics"] = {
                "summary": agent_response.summary,
                "confidence": agent_response.confidence,
                "findings": agent_response.findings,
                "recommendations": agent_response.recommendations,
            }
            # Update flag based on agent recommendation
            if agent_response.requires_further_analysis:
                state["should_run_advanced"] = True
        except Exception:
            pass  # Agent failure shouldn't break the pipeline

        return {
            **state,
            "results": results,
            "agent_insights": agent_insights,
            "problem_type": res.problem_type,
        }

    def run_advanced_metrics(state: AdvancedAuditGraphState) -> AdvancedAuditGraphState:
        """Run advanced metrics (calibration, confidence intervals, adversarial robustness)."""
        if not state.get("should_run_advanced", True):
            return state

        dataset, model = state["dataset"], state["model"]
        exclude_cols = (
            [state.get("sensitive_attribute")] if state.get("sensitive_attribute") else []
        )
        res = evaluate_advanced_metrics(
            dataset, model, settings.artifacts_path, exclude_columns=exclude_cols or None
        )
        results = state.get("results", {})
        results["advanced_metrics"] = {
            "calibration_error": res.calibration_error,
            "brier_score": res.brier_score,
            "confidence_intervals": res.confidence_intervals,
            "adversarial_robustness": res.adversarial_robustness,
            "artifact_path": str(res.artifact_path),
        }
        return {**state, "results": results}

    def run_xai(state: AdvancedAuditGraphState) -> AdvancedAuditGraphState:
        """Run explainability analysis."""
        dataset, model = state["dataset"], state["model"]
        exclude_cols = (
            [state.get("sensitive_attribute")] if state.get("sensitive_attribute") else []
        )
        res = explain_model(
            dataset, model, settings.artifacts_path, exclude_columns=exclude_cols or None
        )
        results = state.get("results", {})
        results["xai"] = {
            "permutation_importance": res.permutation_importance,
            "shap_summary": res.shap_summary,
            "sample_size": res.sample_size,
            "artifact_path": str(res.artifact_path),
        }

        # Agent analysis
        try:
            agent_response = xai_agent.analyze({"xai": results["xai"]})
            agent_insights = state.get("agent_insights", {})
            agent_insights["xai"] = {
                "summary": agent_response.summary,
                "confidence": agent_response.confidence,
                "findings": agent_response.findings,
                "recommendations": agent_response.recommendations,
            }
        except Exception:
            pass

        return {**state, "results": results, "agent_insights": agent_insights}

    def run_stress(state: AdvancedAuditGraphState) -> AdvancedAuditGraphState:
        """Run stress testing (sensitivity + robustness) in parallel conceptually."""
        dataset, model = state["dataset"], state["model"]
        exclude_cols = (
            [state.get("sensitive_attribute")] if state.get("sensitive_attribute") else []
        )

        # Run both analyses
        sens_res = sensitivity_analysis(
            dataset, model, settings.artifacts_path, exclude_columns=exclude_cols or None
        )
        rob_res = robustness_analysis(
            dataset, model, settings.artifacts_path, exclude_columns=exclude_cols or None
        )

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

    def run_fairness(state: AdvancedAuditGraphState) -> AdvancedAuditGraphState:
        """Run fairness analysis if sensitive attribute is provided."""
        if not state.get("should_run_fairness", False):
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

        # Agent analysis
        try:
            agent_response = fairness_agent.analyze(
                {
                    "fairness": results["fairness"],
                    "sensitive_attribute": state.get("sensitive_attribute"),
                    "privileged_values": state.get("privileged_values", []),
                    "unprivileged_values": state.get("unprivileged_values", []),
                }
            )
            agent_insights = state.get("agent_insights", {})
            agent_insights["fairness"] = {
                "summary": agent_response.summary,
                "confidence": agent_response.confidence,
                "findings": agent_response.findings,
                "recommendations": agent_response.recommendations,
            }
        except Exception:
            pass

        return {**state, "results": results, "agent_insights": agent_insights}

    def run_synthesis(state: AdvancedAuditGraphState) -> AdvancedAuditGraphState:
        """Synthesize all agent insights into final recommendations."""
        agent_insights = state.get("agent_insights", {})
        results = state.get("results", {})

        # Combine insights from all agents
        synthesis = {
            "combined_findings": [],
            "combined_recommendations": [],
            "overall_confidence": 0.0,
        }

        confidences = []
        for _agent_name, insights in agent_insights.items():
            if isinstance(insights, dict):
                synthesis["combined_findings"].extend(insights.get("findings", []))
                synthesis["combined_recommendations"].extend(insights.get("recommendations", []))
                confidences.append(insights.get("confidence", 0.5))

        if confidences:
            synthesis["overall_confidence"] = float(np.mean(confidences))

        results["synthesis"] = synthesis
        return {**state, "results": results}

    def run_report(state: AdvancedAuditGraphState) -> AdvancedAuditGraphState:
        """Generate final report."""
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
        results["report"] = {"txt_path": str(res.txt_path)}
        return {**state, "results": results}

    def should_run_advanced_route(state: AdvancedAuditGraphState) -> str:
        """Conditional routing: decide if advanced metrics should run."""
        return "advanced_metrics" if state.get("should_run_advanced", True) else "xai"

    # Add nodes
    graph.add_node("load", load_inputs)
    graph.add_node("metrics", run_metrics)
    graph.add_node("advanced_metrics", run_advanced_metrics)
    graph.add_node("xai", run_xai)
    graph.add_node("stress", run_stress)
    graph.add_node("fairness", run_fairness)
    graph.add_node("synthesis", run_synthesis)
    graph.add_node("report", run_report)

    # Define edges
    graph.set_entry_point("load")
    graph.add_edge("load", "metrics")
    graph.add_conditional_edges(
        "metrics", should_run_advanced_route, {"advanced_metrics": "advanced_metrics", "xai": "xai"}
    )
    graph.add_edge("advanced_metrics", "xai")
    graph.add_edge("xai", "stress")
    graph.add_edge("stress", "fairness")
    graph.add_edge("fairness", "synthesis")
    graph.add_edge("synthesis", "report")
    graph.add_edge("report", END)

    # Compile with checkpoints if enabled
    if checkpointer:
        return graph.compile(checkpointer=checkpointer)
    return graph.compile()


async def run_advanced_audit_graph(
    payload: AdvancedAuditGraphState,
    settings: Settings | None = None,
    enable_checkpoints: bool = True,
) -> AdvancedAuditGraphState:
    """Run the advanced audit graph."""
    settings = settings or get_settings()
    trace = build_trace(
        settings,
        name="advanced_audit_graph",
        input={"dataset_id": payload.get("dataset_id"), "model_id": payload.get("model_id")},
    )
    compiled = build_advanced_audit_graph(
        settings=settings, trace=trace, enable_checkpoints=enable_checkpoints
    )
    return await compiled.ainvoke(payload)
