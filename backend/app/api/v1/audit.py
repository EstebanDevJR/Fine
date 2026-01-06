from __future__ import annotations

import asyncio
import contextlib
import json

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.graph.advanced_audit_graph import run_advanced_audit_graph
from app.ai.graph.audit_graph import run_audit_graph
from app.api.deps import get_app_settings, get_db
from app.core.auth import get_current_user
from app.core.config import Settings
from app.core.ratelimit import rate_limit
from app.db.models import Analysis
from app.domain.audit.repository import (
    delete_analysis,
    get_analysis,
    get_dataset,
    get_model,
    list_analyses,
)
from app.services.diagnose_service import DiagnosisResult, diagnose
from app.services.fairness_service import FairnessResult, evaluate_fairness
from app.services.metrics_service import evaluate_model
from app.services.stress_service import robustness_analysis, sensitivity_analysis
from app.services.xai_service import XAIResult, explain_model
from app.workers.tasks import celery_app

router = APIRouter(tags=["audit"])


class AuditRunRequest(BaseModel):
    dataset_id: int
    model_id: int


class AuditRunResponse(BaseModel):
    problem_type: str
    metrics: dict
    n_samples: int
    n_features: int
    n_classes: int | None
    artifact_path: str


class XAIResponse(BaseModel):
    problem_type: str
    permutation_importance: dict
    shap_summary: dict
    sample_size: int
    artifact_path: str


class SensitivityResponse(BaseModel):
    label_flip_rate: float | None
    proba_shift_mean: float | None
    artifact_path: str


class RobustnessResponse(BaseModel):
    metric_drop: float | None
    missing_feature_impact: dict
    artifact_path: str


class FairnessRequest(BaseModel):
    dataset_id: int
    model_id: int
    sensitive_attribute: str
    privileged_values: list
    unprivileged_values: list
    positive_label: int | float | str = 1


class FairnessResponse(BaseModel):
    demographic_parity_diff: float | None
    disparate_impact: float | None
    equal_opportunity_diff: float | None
    predictive_equality_diff: float | None
    artifact_path: str


class DiagnoseRequest(BaseModel):
    dataset_id: int
    model_id: int
    sensitive_attribute: str | None = None
    privileged_values: list | None = None
    unprivileged_values: list | None = None
    positive_label: int | float | str = 1


class DiagnoseResponse(BaseModel):
    summary: str
    risks: list[str]
    recommendations: list[str]
    artifact_path: str


class FullAuditRequest(BaseModel):
    dataset_id: int
    model_id: int
    sensitive_attribute: str | None = None
    privileged_values: list | None = None
    unprivileged_values: list | None = None
    positive_label: int | float | str = 1


class FullAuditStartResponse(BaseModel):
    job_id: str
    state: str


class FullAuditStatusResponse(BaseModel):
    job_id: str
    state: str
    progress: float | None = None
    step: str | None = None
    status: str | None = None
    detail: str | None = None
    error: str | None = None
    result: dict | None = None
    analysis_id: int | None = None


class ConversationMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class AnalysisQARequest(BaseModel):
    analysis_id: int
    question: str
    page: str | None = None
    page_context: str | None = None
    conversation_history: list[ConversationMessage] | None = None  # Optional conversation history


class AnalysisQAResponse(BaseModel):
    answer: str


class GraphAuditResponse(BaseModel):
    status: str
    problem_type: str | None = None
    results: dict


class AnalysisResponse(BaseModel):
    id: int
    status: str
    dataset_id: int
    model_id: int
    report_path: str | None
    pdf_path: str | None
    result: dict | None
    created_at: str


@router.post(
    "/audit/run",
    response_model=AuditRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Run basic evaluation",
)
async def run_audit(
    payload: AuditRunRequest,
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> AuditRunResponse:
    dataset = await get_dataset(db, payload.dataset_id, user_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset no encontrado")

    model = await get_model(db, payload.model_id, user_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modelo no encontrado")

    result = evaluate_model(dataset, model, settings.artifacts_path)

    return AuditRunResponse(
        problem_type=result.problem_type,
        metrics=result.metrics,
        n_samples=result.n_samples,
        n_features=result.n_features,
        n_classes=result.n_classes,
        artifact_path=str(result.artifact_path),
    )


@router.post(
    "/audit/xai",
    response_model=XAIResponse,
    status_code=status.HTTP_200_OK,
    summary="Interpretability: permutation importance and SHAP",
)
async def run_xai(
    payload: AuditRunRequest,
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> XAIResponse:
    dataset = await get_dataset(db, payload.dataset_id, user_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset no encontrado")

    model = await get_model(db, payload.model_id, user_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modelo no encontrado")

    result: XAIResult = explain_model(dataset, model, settings.artifacts_path)
    return XAIResponse(
        problem_type=result.problem_type,
        permutation_importance={"items": result.permutation_importance},
        shap_summary=result.shap_summary,
        sample_size=result.sample_size,
        artifact_path=str(result.artifact_path),
    )


@router.post(
    "/audit/sensitivity",
    response_model=SensitivityResponse,
    status_code=status.HTTP_200_OK,
    summary="Sensitivity to small perturbations",
)
async def run_sensitivity(
    payload: AuditRunRequest,
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> SensitivityResponse:
    dataset = await get_dataset(db, payload.dataset_id, user_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset no encontrado")

    model = await get_model(db, payload.model_id, user_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modelo no encontrado")

    result = sensitivity_analysis(dataset, model, settings.artifacts_path)
    return SensitivityResponse(
        label_flip_rate=result.label_flip_rate,
        proba_shift_mean=result.proba_shift_mean,
        artifact_path=str(result.artifact_path),
    )


@router.post(
    "/audit/robustness",
    response_model=RobustnessResponse,
    status_code=status.HTTP_200_OK,
    summary="Robustness: strong noise and key-feature masking",
)
async def run_robustness(
    payload: AuditRunRequest,
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> RobustnessResponse:
    dataset = await get_dataset(db, payload.dataset_id, user_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset no encontrado")

    model = await get_model(db, payload.model_id, user_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modelo no encontrado")

    result = robustness_analysis(dataset, model, settings.artifacts_path)
    return RobustnessResponse(
        metric_drop=result.metric_drop,
        missing_feature_impact=result.missing_feature_impact,
        artifact_path=str(result.artifact_path),
    )


@router.post(
    "/audit/fairness",
    response_model=FairnessResponse,
    status_code=status.HTTP_200_OK,
    summary="Fairness (binary target)",
)
async def run_fairness(
    payload: FairnessRequest,
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> FairnessResponse:
    dataset = await get_dataset(db, payload.dataset_id, user_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset no encontrado")

    model = await get_model(db, payload.model_id, user_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modelo no encontrado")

    result: FairnessResult = evaluate_fairness(
        dataset=dataset,
        model_artifact=model,
        artifacts_path=settings.artifacts_path,
        sensitive_attribute=payload.sensitive_attribute,
        privileged_values=payload.privileged_values,
        unprivileged_values=payload.unprivileged_values,
        positive_label=payload.positive_label,
    )

    return FairnessResponse(
        demographic_parity_diff=result.demographic_parity_diff,
        disparate_impact=result.disparate_impact,
        equal_opportunity_diff=result.equal_opportunity_diff,
        predictive_equality_diff=result.predictive_equality_diff,
        artifact_path=str(result.artifact_path),
    )


@router.post(
    "/audit/diagnose",
    response_model=DiagnoseResponse,
    status_code=status.HTTP_200_OK,
    summary="LLM diagnosis over collected artefacts",
)
async def run_diagnose(
    payload: DiagnoseRequest,
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> DiagnoseResponse:
    dataset = await get_dataset(db, payload.dataset_id, user_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    model = await get_model(db, payload.model_id, user_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")

    result: DiagnosisResult = diagnose(
        dataset=dataset,
        model=model,
        settings=settings,
        sensitive_attribute=payload.sensitive_attribute,
        privileged_values=payload.privileged_values,
        unprivileged_values=payload.unprivileged_values,
        positive_label=payload.positive_label,
    )
    return DiagnoseResponse(
        summary=result.summary,
        risks=result.risks,
        recommendations=result.recommendations,
        artifact_path=str(result.artifact_path),
    )


@router.post(
    "/audit/full",
    response_model=FullAuditStartResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Run full audit (async pipeline)",
)
async def run_full_audit(
    payload: FullAuditRequest,
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
) -> FullAuditStartResponse:
    task = celery_app.send_task(
        "audit.full",
        kwargs={
            "dataset_id": payload.dataset_id,
            "model_id": payload.model_id,
            "owner_id": user_id,
            "sensitive_attribute": payload.sensitive_attribute,
            "privileged_values": payload.privileged_values,
            "unprivileged_values": payload.unprivileged_values,
            "positive_label": payload.positive_label,
        },
    )
    return FullAuditStartResponse(job_id=task.id, state=task.state or "PENDING")


@router.get(
    "/audit/full/{job_id}",
    response_model=FullAuditStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get full audit job status",
)
async def get_full_audit_status(
    job_id: str,
    _: None = Depends(rate_limit),
) -> FullAuditStatusResponse:
    result = AsyncResult(job_id, app=celery_app)
    meta = result.info if isinstance(result.info, dict) else {}

    error_message = None
    if result.failed():
        error_message = meta.get("error") if isinstance(meta, dict) else str(result.result)

    return FullAuditStatusResponse(
        job_id=job_id,
        state=result.state,
        progress=meta.get("progress") if meta else None,
        step=meta.get("step") if meta else None,
        status=meta.get("status") if meta else None,
        detail=meta.get("detail") if meta else None,
        error=error_message,
        result=result.result if result.successful() else None,
        analysis_id=meta.get("analysis_id")
        or (result.result.get("analysis_id") if isinstance(result.result, dict) else None),
    )


@router.get(
    "/audit/full/{job_id}/events",
    summary="Stream full audit job status via SSE (text/event-stream)",
)
async def stream_full_audit_status(
    job_id: str,
    _: None = Depends(rate_limit),
):
    async def event_gen():
        last_payload = None
        while True:
            result = AsyncResult(job_id, app=celery_app)
            meta = result.info if isinstance(result.info, dict) else {}

            payload = {
                "job_id": job_id,
                "state": result.state,
                "progress": meta.get("progress") if meta else None,
                "step": meta.get("step") if meta else None,
                "status": meta.get("status") if meta else None,
                "detail": meta.get("detail") if meta else None,
                "error": (
                    meta.get("error") if result.failed() and isinstance(meta, dict) else None
                ),
                "result": result.result if result.successful() else None,
                "analysis_id": meta.get("analysis_id")
                or (result.result.get("analysis_id") if isinstance(result.result, dict) else None),
            }

            if payload != last_payload:
                last_payload = payload
                yield f"event: status\ndata: {json.dumps(payload)}\n\n"

            if result.state in ("SUCCESS", "FAILURE"):
                yield f"event: done\ndata: {json.dumps(payload)}\n\n"
                break

            await asyncio.sleep(1.0)

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post(
    "/audit/qa",
    response_model=AnalysisQAResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask questions about an existing analysis",
)
async def analysis_qa(
    payload: AnalysisQARequest,
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    row: Analysis | None = await get_analysis(db, payload.analysis_id, user_id)
    if not row or not row.result_json:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")

    try:
        result = json.loads(row.result_json)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Analysis payload unreadable"
        ) from exc

    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LLM not configured"
        )

    try:
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
        from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
        from langchain_openai import ChatOpenAI
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM backend not available: {exc}",
        ) from exc

    metrics = result.get("evaluate", {}).get("metrics", {}) if isinstance(result, dict) else {}
    diagnose = result.get("diagnose", {}) if isinstance(result, dict) else {}
    fairness = result.get("fairness", {}) if isinstance(result, dict) else {}
    robustness = result.get("robustness", {}) if isinstance(result, dict) else {}
    sensitivity = result.get("sensitivity", {}) if isinstance(result, dict) else {}
    xai = result.get("xai", {}) if isinstance(result, dict) else {}

    # Build conversation history from payload
    messages = []
    
    # System message with context
    system_content = f"""You are an ML audit assistant for the Fine app. Stay on-topic: only answer about audit results,
dashboards, uploads, analyses, and this web app. Refuse unrelated requests politely.
Be concise (<=5 sentences). Use short bullet-like phrases if listing.

Page context: {payload.page or "unknown"} | {payload.page_context or ""}

Available analysis context:
- Metrics: {metrics}
- Diagnosis summary: {diagnose.get("summary", "N/A")}
- Risks: {diagnose.get("risks", [])}
- Recommendations: {diagnose.get("recommendations", [])}
- Fairness: {fairness}
- Robustness: {robustness}
- Sensitivity: {sensitivity}
- XAI: {xai}"""
    
    messages.append(SystemMessage(content=system_content))
    
    # Add conversation history if provided
    if payload.conversation_history:
        for msg in payload.conversation_history:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                messages.append(AIMessage(content=msg.content))
    
    # Add current question
    messages.append(HumanMessage(content=payload.question.strip()))

    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        base_url=str(settings.openai_api_base) if settings.openai_api_base else None,
        temperature=0.7,
        max_tokens=200,
    )

    resp = llm.invoke(messages)

    content = resp.content if hasattr(resp, "content") else str(resp)
    return AnalysisQAResponse(answer=content)


@router.post(
    "/audit/graph",
    response_model=GraphAuditResponse,
    status_code=status.HTTP_200_OK,
    summary="Run full audit via LangGraph (sync)",
)
async def run_graph_audit(
    payload: FullAuditRequest,
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
    settings: Settings = Depends(get_app_settings),
) -> GraphAuditResponse:
    try:
        result_state = await run_audit_graph(
            {**payload.dict(), "owner_id": user_id}, settings=settings
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc

    return GraphAuditResponse(
        status="completed",
        problem_type=result_state.get("problem_type"),
        results=result_state.get("results", {}),
    )


@router.post(
    "/audit/graph/advanced",
    response_model=GraphAuditResponse,
    status_code=status.HTTP_200_OK,
    summary="Run advanced audit via LangGraph with specialized agents",
)
async def run_advanced_graph_audit(
    payload: FullAuditRequest,
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
    settings: Settings = Depends(get_app_settings),
) -> GraphAuditResponse:
    """Run advanced audit with specialized LLM agents, conditional routing, and advanced metrics."""
    try:
        result_state = await run_advanced_audit_graph(
            {**payload.dict(), "owner_id": user_id}, settings=settings, enable_checkpoints=True
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc

    # Include agent insights in response
    results = result_state.get("results", {})
    results["agent_insights"] = result_state.get("agent_insights", {})

    return GraphAuditResponse(
        status="completed",
        problem_type=result_state.get("problem_type"),
        results=results,
    )


@router.get(
    "/audit/analyses",
    response_model=list[AnalysisResponse],
    status_code=status.HTTP_200_OK,
    summary="List analyses for current user",
)
async def list_user_analyses(
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await list_analyses(db, user_id)
    out: list[AnalysisResponse] = []
    for r in rows:
        payload = {
            "id": r.id,
            "status": r.status,
            "dataset_id": r.dataset_id,
            "model_id": r.model_id,
            "report_path": r.report_path,
            "pdf_path": r.pdf_path,
            "created_at": r.created_at.isoformat(),
            "result": None,
        }
        if r.result_json:
            try:
                payload["result"] = json.loads(r.result_json)
            except Exception:
                payload["result"] = None
        out.append(AnalysisResponse(**payload))
    return out


@router.get(
    "/audit/analyses/{analysis_id}",
    response_model=AnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Get analysis detail",
)
async def get_user_analysis(
    analysis_id: int,
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await get_analysis(db, analysis_id, user_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
    payload = {
        "id": row.id,
        "status": row.status,
        "dataset_id": row.dataset_id,
        "model_id": row.model_id,
        "report_path": row.report_path,
        "pdf_path": row.pdf_path,
        "created_at": row.created_at.isoformat(),
        "result": None,
    }
    if row.result_json:
        try:
            payload["result"] = json.loads(row.result_json)
        except Exception:
            payload["result"] = None
    return AnalysisResponse(**payload)


@router.delete(
    "/audit/analyses/{analysis_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete analysis",
)
async def delete_user_analysis(
    analysis_id: int,
    _: None = Depends(rate_limit),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    row = await get_analysis(db, analysis_id, user_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
    # Delete report artifacts
    from pathlib import Path

    with contextlib.suppress(Exception):
        if row.report_path and not row.report_path.startswith("s3://"):
            Path(row.report_path).unlink(missing_ok=True)  # type: ignore[arg-type]
        if row.pdf_path and not row.pdf_path.startswith("s3://"):
            Path(row.pdf_path).unlink(missing_ok=True)  # type: ignore[arg-type]
    if row.report_path and row.report_path.startswith("s3://"):
        from app.core.s3 import delete_s3_uri

        with contextlib.suppress(Exception):
            delete_s3_uri(settings, row.report_path)
    if row.pdf_path and row.pdf_path.startswith("s3://"):
        from app.core.s3 import delete_s3_uri

        with contextlib.suppress(Exception):
            delete_s3_uri(settings, row.pdf_path)
    await delete_analysis(db, analysis_id, user_id)
    return {}
