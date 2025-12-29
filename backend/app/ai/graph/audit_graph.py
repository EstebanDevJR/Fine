from __future__ import annotations

from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from app.ai.graph.nodes.fairness_node import run_fairness
from app.ai.graph.nodes.metrics_node import run_metrics
from app.ai.graph.nodes.overfit import run_overfit
from app.ai.graph.nodes.reasoning_node import run_reasoning
from app.ai.graph.nodes.stress_node import run_stress
from app.ai.graph.nodes.xai_node import run_xai
from app.core.config import Settings, get_settings
from app.core.tracing import TraceWrapper, build_trace
from app.db.session import AsyncSessionLocal
from app.domain.audit.repository import get_dataset, get_model
from app.services.report_service import generate_report


class AuditGraphState(TypedDict, total=False):
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
    results: dict
    error: str


def build_audit_graph(
    settings: Settings | None = None,
    trace: TraceWrapper | None = None,
    trace_input: dict | None = None,
):
    settings = settings or get_settings()
    trace = trace or build_trace(settings, name="audit_graph", input=trace_input)
    graph = StateGraph(AuditGraphState)

    async def load_inputs(state: AuditGraphState) -> AuditGraphState:
        owner_id = state.get("owner_id")
        async with AsyncSessionLocal() as db:
            dataset = await get_dataset(db, state["dataset_id"], owner_id) if owner_id else None
            model = await get_model(db, state["model_id"], owner_id) if owner_id else None
            if not dataset or not model:
                raise ValueError("Dataset or model not found")
        return {**state, "dataset": dataset, "model": model, "results": {}, "problem_type": None}

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

    def _wrap(name: str, fn):
        def _inner(state: AuditGraphState) -> AuditGraphState:
            span = trace.span(
                name,
                input={"dataset_id": state.get("dataset_id"), "model_id": state.get("model_id")},
            )
            try:
                res = fn(state)
                span.end(output=res.get("results"))
                return res
            except Exception as exc:
                span.end(error=str(exc))
                raise

        return _inner

    graph.add_node("load", load_inputs)
    graph.add_node("metrics", _wrap("metrics", lambda s: run_metrics(s, settings)))
    graph.add_node("xai", _wrap("xai", lambda s: run_xai(s, settings)))
    graph.add_node("stress", _wrap("stress", lambda s: run_stress(s, settings)))
    graph.add_node("fairness", _wrap("fairness", lambda s: run_fairness(s, settings)))
    graph.add_node("overfit", _wrap("overfit", run_overfit))
    graph.add_node("reasoning", _wrap("reasoning", lambda s: run_reasoning(s, settings)))
    graph.add_node("report", _wrap("report", run_report))

    graph.set_entry_point("load")
    graph.add_edge("load", "metrics")
    graph.add_edge("metrics", "xai")
    graph.add_edge("xai", "stress")
    graph.add_edge("stress", "fairness")
    graph.add_edge("fairness", "overfit")
    graph.add_edge("overfit", "reasoning")
    graph.add_edge("reasoning", "report")
    graph.add_edge("report", END)

    return graph.compile()


async def run_audit_graph(
    payload: AuditGraphState, settings: Settings | None = None
) -> AuditGraphState:
    settings = settings or get_settings()
    trace = build_trace(
        settings,
        name="audit_graph",
        input={"dataset_id": payload.get("dataset_id"), "model_id": payload.get("model_id")},
    )
    compiled = build_audit_graph(settings=settings, trace=trace)
    return await compiled.ainvoke(payload)
