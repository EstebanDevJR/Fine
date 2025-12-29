from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.core.config import Settings
from app.core.metrics import incr, observe_time
from app.db.models import Dataset, ModelArtifact
from app.services.fairness_service import evaluate_fairness
from app.services.metrics_service import evaluate_model
from app.services.stress_service import robustness_analysis, sensitivity_analysis
from app.services.xai_service import explain_model


@dataclass
class DiagnosisResult:
    summary: str
    risks: list[str]
    recommendations: list[str]
    artifact_path: Path


def _save_artifact(base: Path, data: Dict[str, Any]) -> Path:
    base.mkdir(parents=True, exist_ok=True)
    path = base / f"diagnosis_{uuid.uuid4().hex}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return path


def _build_prompt(metrics: dict, xai: dict, sensitivity: dict, robustness: dict, fairness: dict | None):
    return ChatPromptTemplate.from_template(
        """
You are an ML audit assistant. Summarize technical findings with brevity and precision.
Inputs:
- Metrics: {metrics}
- XAI: {xai}
- Sensitivity: {sensitivity}
- Robustness: {robustness}
- Fairness: {fairness}

Respond ONLY with a JSON object (no prose) using keys:
- summary: 3-4 sentences in natural language.
- risks: array of short bullet strings (if none, return []).
- recommendations: array of short bullet strings (if none, return []). 
Avoid pleasantries; be concise and actionable. Do not add code fences.
        """
    )


def diagnose(
    *,
    dataset: Dataset,
    model: ModelArtifact,
    settings: Settings,
    sensitive_attribute: Optional[str] = None,
    privileged_values: Optional[list[Any]] = None,
    unprivileged_values: Optional[list[Any]] = None,
    positive_label: int | float | str = 1,
) -> DiagnosisResult:
    # Collect artefacts
    start_ts = uuid.uuid4().hex  # just an id for logging timings
    exclude_cols = [sensitive_attribute] if sensitive_attribute else []

    metrics_res = evaluate_model(
        dataset, model, settings.artifacts_path, exclude_columns=exclude_cols or None
    )
    xai_res = explain_model(
        dataset,
        model,
        settings.artifacts_path,
        exclude_columns=exclude_cols or None,
        max_samples=2000,
    )
    sens_res = sensitivity_analysis(
        dataset,
        model,
        settings.artifacts_path,
        exclude_columns=exclude_cols or None,
        max_samples=2000,
    )
    rob_res = robustness_analysis(
        dataset,
        model,
        settings.artifacts_path,
        exclude_columns=exclude_cols or None,
        max_samples=2000,
    )

    fairness_payload = None
    if sensitive_attribute and privileged_values and unprivileged_values:
        fairness_res = evaluate_fairness(
            dataset=dataset,
            model_artifact=model,
            artifacts_path=settings.artifacts_path,
            sensitive_attribute=sensitive_attribute,
            privileged_values=privileged_values,
            unprivileged_values=unprivileged_values,
            positive_label=positive_label,
        )
        fairness_payload = {
            "demographic_parity_diff": fairness_res.demographic_parity_diff,
            "disparate_impact": fairness_res.disparate_impact,
            "equal_opportunity_diff": fairness_res.equal_opportunity_diff,
            "predictive_equality_diff": fairness_res.predictive_equality_diff,
            "artifact_path": str(fairness_res.artifact_path),
        }

    prompt = _build_prompt(
        metrics={
            "problem_type": metrics_res.problem_type,
            "metrics": metrics_res.metrics,
        },
        xai={
            "permutation_importance": xai_res.permutation_importance,
            "shap": xai_res.shap_summary,
        },
        sensitivity={
            "label_flip_rate": sens_res.label_flip_rate,
            "proba_shift_mean": sens_res.proba_shift_mean,
        },
        robustness={
            "metric_drop": rob_res.metric_drop,
            "missing_feature_impact": rob_res.missing_feature_impact,
        },
        fairness=fairness_payload or {},
    )

    llm = ChatOpenAI(
        model=settings.openai_model,
        temperature=0,
        max_tokens=400,
        api_key=settings.openai_api_key,
        base_url=str(settings.openai_api_base) if settings.openai_api_base else None,
    )
    chain = prompt | llm
    llm_start = time.perf_counter()
    resp = chain.invoke(
        {
            "metrics": {
                "problem_type": metrics_res.problem_type,
                "metrics": metrics_res.metrics,
            },
            "xai": {
                "permutation_importance": xai_res.permutation_importance,
                "shap": xai_res.shap_summary,
            },
            "sensitivity": {
                "label_flip_rate": sens_res.label_flip_rate,
                "proba_shift_mean": sens_res.proba_shift_mean,
            },
            "robustness": {
                "metric_drop": rob_res.metric_drop,
                "missing_feature_impact": rob_res.missing_feature_impact,
            },
            "fairness": fairness_payload or {},
        }
    )
    observe_time("diagnose.llm_ms", (time.perf_counter() - llm_start) * 1000)
    incr("diagnose.calls", 1)

    content = resp.content if hasattr(resp, "content") else str(resp)

    def _safe_parse_json(payload: str) -> dict:
        txt = payload.strip()
        if txt.startswith("```"):
            # Remove code fences if model added them
            lines = txt.splitlines()
            lines = [ln for ln in lines if not ln.strip().startswith("```")]
            txt = "\n".join(lines).strip()
        try:
            return json.loads(txt)
        except Exception:
            return {}

    parsed = _safe_parse_json(content)
    summary = parsed.get("summary") if isinstance(parsed, dict) else None
    risks = parsed.get("risks") if isinstance(parsed, dict) else None
    recs = parsed.get("recommendations") if isinstance(parsed, dict) else None

    if not isinstance(risks, list):
        risks = []
    if not isinstance(recs, list):
        recs = []
    if not isinstance(summary, str):
        summary = content

    artifact = {
        "summary": content,
        "metrics": metrics_res.metrics,
        "problem_type": metrics_res.problem_type,
        "xai": {
            "permutation_importance": xai_res.permutation_importance,
            "shap_summary": xai_res.shap_summary,
        },
        "sensitivity": {
            "label_flip_rate": sens_res.label_flip_rate,
            "proba_shift_mean": sens_res.proba_shift_mean,
        },
        "robustness": {
            "metric_drop": rob_res.metric_drop,
            "missing_feature_impact": rob_res.missing_feature_impact,
        },
        "fairness": fairness_payload,
    }
    artifact_path = _save_artifact(settings.artifacts_path, artifact)

    return DiagnosisResult(
        summary=summary,
        risks=risks,
        recommendations=recs,
        artifact_path=artifact_path,
    )

