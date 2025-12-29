from __future__ import annotations

import json
from pathlib import Path

from celery import Celery

from app.core.config import get_settings
from app.core.s3 import build_s3_path, upload_file
from app.db.session import AsyncSessionLocal
from app.domain.audit.repository import create_analysis, get_dataset, get_model
from app.services.diagnose_service import diagnose
from app.services.fairness_service import evaluate_fairness
from app.services.metrics_service import evaluate_model
from app.services.report_service import generate_report
from app.services.stress_service import robustness_analysis, sensitivity_analysis
from app.services.xai_service import explain_model

settings = get_settings()

celery_app = Celery(
    "fine_audit",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_default_queue="audit",
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
)


@celery_app.task(name="audit.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="audit.evaluate")
def evaluate(dataset_id: int, model_id: int, owner_id: str) -> dict:
    """Ejecuta evaluación básica en background."""
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            dataset = await get_dataset(db, dataset_id, owner_id)
            model = await get_model(db, model_id, owner_id)
            if not dataset or not model:
                return {"error": "dataset or model not found"}
            result = evaluate_model(dataset, model, settings.artifacts_path)
            return {
                "problem_type": result.problem_type,
                "metrics": result.metrics,
                "n_samples": result.n_samples,
                "n_features": result.n_features,
                "n_classes": result.n_classes,
                "artifact_path": str(result.artifact_path),
            }

    return asyncio.run(_run())


@celery_app.task(name="audit.xai")
def xai(dataset_id: int, model_id: int, owner_id: str) -> dict:
    """Ejecuta interpretabilidad (permutation + SHAP) en background."""
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            dataset = await get_dataset(db, dataset_id, owner_id)
            model = await get_model(db, model_id, owner_id)
            if not dataset or not model:
                return {"error": "dataset or model not found"}
            result = explain_model(dataset, model, settings.artifacts_path)
            return {
                "problem_type": result.problem_type,
                "permutation_importance": result.permutation_importance,
                "shap_summary": result.shap_summary,
                "sample_size": result.sample_size,
                "artifact_path": str(result.artifact_path),
            }

    return asyncio.run(_run())


@celery_app.task(name="audit.sensitivity")
def sensitivity(dataset_id: int, model_id: int, owner_id: str) -> dict:
    """Ejecuta sensibilidad a perturbaciones en background."""
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            dataset = await get_dataset(db, dataset_id, owner_id)
            model = await get_model(db, model_id, owner_id)
            if not dataset or not model:
                return {"error": "dataset or model not found"}
            result = sensitivity_analysis(dataset, model, settings.artifacts_path)
            return {
                "label_flip_rate": result.label_flip_rate,
                "proba_shift_mean": result.proba_shift_mean,
                "artifact_path": str(result.artifact_path),
            }

    return asyncio.run(_run())


@celery_app.task(name="audit.robustness")
def robustness(dataset_id: int, model_id: int, owner_id: str) -> dict:
    """Ejecuta robustez (ruido fuerte + masking) en background."""
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            dataset = await get_dataset(db, dataset_id, owner_id)
            model = await get_model(db, model_id, owner_id)
            if not dataset or not model:
                return {"error": "dataset or model not found"}
            result = robustness_analysis(dataset, model, settings.artifacts_path)
            return {
                "metric_drop": result.metric_drop,
                "missing_feature_impact": result.missing_feature_impact,
                "artifact_path": str(result.artifact_path),
            }

    return asyncio.run(_run())


@celery_app.task(name="audit.fairness")
def fairness(
    dataset_id: int,
    model_id: int,
    owner_id: str,
    sensitive_attribute: str,
    privileged_values: list,
    unprivileged_values: list,
    positive_label=1,
) -> dict:
    """Ejecuta fairness básico en background."""
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            dataset = await get_dataset(db, dataset_id, owner_id)
            model = await get_model(db, model_id, owner_id)
            if not dataset or not model:
                return {"error": "dataset or model not found"}
            result = evaluate_fairness(
                dataset=dataset,
                model_artifact=model,
                artifacts_path=settings.artifacts_path,
                sensitive_attribute=sensitive_attribute,
                privileged_values=privileged_values,
                unprivileged_values=unprivileged_values,
                positive_label=positive_label,
            )
            return {
                "demographic_parity_diff": result.demographic_parity_diff,
                "disparate_impact": result.disparate_impact,
                "equal_opportunity_diff": result.equal_opportunity_diff,
                "predictive_equality_diff": result.predictive_equality_diff,
                "artifact_path": str(result.artifact_path),
            }

    return asyncio.run(_run())


@celery_app.task(name="audit.diagnose")
def diagnose_task(
    dataset_id: int,
    model_id: int,
    owner_id: str,
    sensitive_attribute: str | None = None,
    privileged_values: list | None = None,
    unprivileged_values: list | None = None,
    positive_label=1,
) -> dict:
    """Runs LLM-based diagnosis over collected artefacts."""
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            dataset = await get_dataset(db, dataset_id, owner_id)
            model = await get_model(db, model_id, owner_id)
            if not dataset or not model:
                return {"error": "dataset or model not found"}
            result = diagnose(
                dataset=dataset,
                model=model,
                settings=settings,
                sensitive_attribute=sensitive_attribute,
                privileged_values=privileged_values,
                unprivileged_values=unprivileged_values,
                positive_label=positive_label,
            )
            return {
                "summary": result.summary,
                "risks": result.risks,
                "recommendations": result.recommendations,
                "artifact_path": str(result.artifact_path),
            }

    return asyncio.run(_run())


@celery_app.task(name="audit.full", bind=True)
def full_audit(
    self,
    dataset_id: int,
    model_id: int,
    owner_id: str,
    sensitive_attribute: str | None = None,
    privileged_values: list | None = None,
    unprivileged_values: list | None = None,
    positive_label=1,
) -> dict:
    """Runs the full audit pipeline in sequence and reports progress."""
    import asyncio

    def _report(
        step_index: int, total_steps: int, step: str, status: str, detail: str | None = None
    ) -> None:
        progress = min(max((step_index / total_steps), 0.0), 1.0)
        meta = {"step": step, "status": status, "progress": round(progress, 3)}
        if detail:
            meta["detail"] = detail
        try:
            self.update_state(state="PROGRESS", meta=meta)
        except (Exception, BaseException) as e:
            # If updating state fails (e.g., corrupted backend state, worker shutdown),
            # silently continue to avoid cascading errors
            import logging

            logger = logging.getLogger(__name__)
            error_type = type(e).__name__
            error_msg = str(e) if e else "Unknown error"
            logger.warning(
                f"Failed to update progress state ({error_type}): {error_msg}. Continuing execution..."
            )

    async def _run():
        async with AsyncSessionLocal() as db:
            dataset = await get_dataset(db, dataset_id, owner_id)
            model = await get_model(db, model_id, owner_id)
            if not dataset or not model:
                return {"error": "dataset or model not found"}

            steps = [
                "evaluate",
                "xai",
                "sensitivity",
                "robustness",
                "fairness",
                "diagnose",
                "report",
            ]
            total_steps = len(steps)

            results: dict = {"problem_type": None}

            # Evaluate
            _report(0, total_steps, "evaluate", "running")
            eval_res = evaluate_model(dataset, model, settings.artifacts_path)
            results["problem_type"] = eval_res.problem_type
            results["evaluate"] = {
                "metrics": eval_res.metrics,
                "n_samples": eval_res.n_samples,
                "n_features": eval_res.n_features,
                "n_classes": eval_res.n_classes,
                "artifact_path": str(eval_res.artifact_path),
            }
            _report(1, total_steps, "evaluate", "completed")

            # XAI
            _report(1, total_steps, "xai", "running")
            xai_res = explain_model(dataset, model, settings.artifacts_path)
            results["xai"] = {
                "permutation_importance": xai_res.permutation_importance,
                "shap_summary": xai_res.shap_summary,
                "sample_size": xai_res.sample_size,
                "artifact_path": str(xai_res.artifact_path),
            }
            _report(2, total_steps, "xai", "completed")

            # Sensitivity
            _report(2, total_steps, "sensitivity", "running")
            sens_res = sensitivity_analysis(dataset, model, settings.artifacts_path)
            results["sensitivity"] = {
                "label_flip_rate": sens_res.label_flip_rate,
                "proba_shift_mean": sens_res.proba_shift_mean,
                "artifact_path": str(sens_res.artifact_path),
            }
            _report(3, total_steps, "sensitivity", "completed")

            # Robustness
            _report(3, total_steps, "robustness", "running")
            rob_res = robustness_analysis(dataset, model, settings.artifacts_path)
            results["robustness"] = {
                "metric_drop": rob_res.metric_drop,
                "missing_feature_impact": rob_res.missing_feature_impact,
                "artifact_path": str(rob_res.artifact_path),
            }
            _report(4, total_steps, "robustness", "completed")

            # Fairness (optional)
            fairness_idx = 4
            if sensitive_attribute:
                fairness_idx = 4
                _report(fairness_idx, total_steps, "fairness", "running")
                fair_res = evaluate_fairness(
                    dataset=dataset,
                    model_artifact=model,
                    artifacts_path=settings.artifacts_path,
                    sensitive_attribute=sensitive_attribute,
                    privileged_values=privileged_values or [],
                    unprivileged_values=unprivileged_values or [],
                    positive_label=positive_label,
                )
                results["fairness"] = {
                    "demographic_parity_diff": fair_res.demographic_parity_diff,
                    "disparate_impact": fair_res.disparate_impact,
                    "equal_opportunity_diff": fair_res.equal_opportunity_diff,
                    "predictive_equality_diff": fair_res.predictive_equality_diff,
                    "artifact_path": str(fair_res.artifact_path),
                }
                _report(fairness_idx + 1, total_steps, "fairness", "completed")
            else:
                results["fairness"] = {"skipped": True, "reason": "No sensitive attribute provided"}
                _report(
                    fairness_idx + 1,
                    total_steps,
                    "fairness",
                    "skipped",
                    "No sensitive attribute provided",
                )

            # Diagnose
            _report(5, total_steps, "diagnose", "running")
            diag_res = diagnose(
                dataset=dataset,
                model=model,
                settings=settings,
                sensitive_attribute=sensitive_attribute,
                privileged_values=privileged_values,
                unprivileged_values=unprivileged_values,
                positive_label=positive_label,
            )
            results["diagnose"] = {
                "summary": diag_res.summary,
                "risks": diag_res.risks,
                "recommendations": diag_res.recommendations,
                "artifact_path": str(diag_res.artifact_path),
            }
            _report(6, total_steps, "diagnose", "completed")

            # Report
            _report(6, total_steps, "report", "running")
            # Generate text report
            report_res = generate_report(
                dataset=dataset,
                model=model,
                settings=settings,
                sensitive_attribute=sensitive_attribute,
                privileged_values=privileged_values,
                unprivileged_values=unprivileged_values,
                positive_label=positive_label,
            )
            results["report"] = {
                "txt_path": str(report_res.txt_path),
            }
            _report(total_steps, total_steps, "report", "completed")

            # Optional: upload report to S3 (TXT file)
            txt_s3 = None
            try:
                if (
                    settings.s3_bucket_reports
                    and report_res.txt_path
                    and report_res.txt_path.exists()
                ):
                    # Upload TXT to S3
                    txt_key = build_s3_path("reports", owner_id, Path(report_res.txt_path).name)
                    txt_s3 = upload_file(
                        settings, settings.s3_bucket_reports, txt_key, str(report_res.txt_path)
                    )
            except Exception as e:
                # Log error but do not fail the task if upload fails
                import logging

                logger = logging.getLogger(__name__)
                logger.error(f"Failed to upload TXT report to S3: {e}")

            # Persist analysis record
            final_txt_path = txt_s3 or str(report_res.txt_path)

            analysis = await create_analysis(
                db,
                owner_id=owner_id,
                dataset_id=dataset_id,
                model_id=model_id,
                status="completed",
                result_json=json.dumps(results),
                report_path=final_txt_path,  # TXT file path
                pdf_path=None,  # No PDF anymore
            )

            return {
                "status": "completed",
                "progress": 1.0,
                "results": results,
                "analysis_id": analysis.id,
            }

    try:
        return asyncio.run(_run())
    except (Exception, BaseException) as exc:
        import logging
        import traceback

        logger = logging.getLogger(__name__)

        error_msg = str(exc) if exc else "Unknown error"
        error_type = type(exc).__name__ if exc else "UnknownError"

        # Don't try to update state for KeyboardInterrupt or SystemExit
        # as these are typically worker shutdown signals
        if isinstance(exc, KeyboardInterrupt | SystemExit):
            logger.warning(f"Task interrupted: {error_type}: {error_msg}")
            raise

        try:
            # Try to update state, but don't fail if backend has corrupted state
            # Limit error message and traceback to avoid serialization issues
            safe_error_msg = error_msg[:200] if len(error_msg) > 200 else error_msg
            safe_traceback = traceback.format_exc()[:500] if exc else ""

            self.update_state(
                state="FAILURE",
                meta={
                    "error": safe_error_msg,
                    "error_type": error_type,
                    "step": "full_audit",
                    "traceback": safe_traceback,
                },
            )
        except (Exception, BaseException) as state_error:
            # If updating state fails (e.g., corrupted backend state, serialization error),
            # just log it and continue - don't let this cause cascading failures
            state_error_type = type(state_error).__name__ if state_error else "UnknownError"
            state_error_msg = str(state_error) if state_error else "Unknown error"
            logger.error(
                f"Failed to update task state ({state_error_type}): {state_error_msg}. Original error: {error_type}: {error_msg}"
            )

        # Re-raise the original exception so Celery can handle it
        raise


@celery_app.task(name="report.generate")
def generate_report_task(
    dataset_id: int,
    model_id: int,
    owner_id: str,
    sensitive_attribute: str | None = None,
    privileged_values: list | None = None,
    unprivileged_values: list | None = None,
    positive_label=1,
) -> dict:
    """Generate TXT report in background."""
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            dataset = await get_dataset(db, dataset_id, owner_id)
            model = await get_model(db, model_id, owner_id)
            if not dataset or not model:
                return {"error": "dataset or model not found"}
            result = generate_report(
                dataset=dataset,
                model=model,
                settings=settings,
                sensitive_attribute=sensitive_attribute,
                privileged_values=privileged_values,
                unprivileged_values=unprivileged_values,
                positive_label=positive_label,
            )
            return {
                "txt_path": str(result.txt_path),
            }

    return asyncio.run(_run())
