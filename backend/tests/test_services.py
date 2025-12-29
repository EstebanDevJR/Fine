from pathlib import Path

import pandas as pd
from app.core.config import Settings
from app.db.models import Dataset, ModelArtifact
from app.services.diagnose_service import diagnose
from app.services.metrics_service import evaluate_model
from app.services.stress_service import robustness_analysis, sensitivity_analysis
from app.services.xai_service import explain_model
from app.services.fairness_service import evaluate_fairness
from app.services.report_service import generate_report


def make_dataset_model(dataset_path: Path, model_path: Path, storage: Path):
    ds = Dataset(
        id=1,
        name="test_ds",
        filename=dataset_path.name,
        path=str(dataset_path),
        file_format="csv",
        size_bytes=dataset_path.stat().st_size,
        target_column="label",
        checksum="",
    )
    model = ModelArtifact(
        id=1,
        name="test_model",
        framework="sklearn",
        task_type="classification",
        filename=model_path.name,
        path=str(model_path),
        size_bytes=model_path.stat().st_size,
        checksum="",
        description="",
    )
    settings = Settings(
        storage_base_path=storage,
        reports_path=storage / "reports",
        models_path=storage / "models",
        datasets_path=storage / "datasets",
        artifacts_path=storage / "artifacts",
    )
    return ds, model, settings


def test_evaluate_and_xai(sample_dataset, sample_model, tmp_storage):
    ds, model, settings = make_dataset_model(sample_dataset, sample_model, tmp_storage)
    metrics = evaluate_model(ds, model, settings.artifacts_path)
    assert metrics.metrics["accuracy"] == 1.0
    xai = explain_model(ds, model, settings.artifacts_path)
    assert len(xai.permutation_importance) > 0


def test_sensitivity_and_robustness(sample_dataset, sample_model, tmp_storage):
    ds, model, settings = make_dataset_model(sample_dataset, sample_model, tmp_storage)
    sens = sensitivity_analysis(ds, model, settings.artifacts_path)
    rob = robustness_analysis(ds, model, settings.artifacts_path)
    assert sens.label_flip_rate is not None
    assert rob.metric_drop is not None


def test_fairness(sample_dataset, sample_model, tmp_storage):
    ds, model, settings = make_dataset_model(sample_dataset, sample_model, tmp_storage)
    fairness = evaluate_fairness(
        dataset=ds,
        model_artifact=model,
        artifacts_path=settings.artifacts_path,
        sensitive_attribute="gender",
        privileged_values=["M"],
        unprivileged_values=["F"],
        positive_label=1,
    )
    assert fairness.demographic_parity_diff is not None


def test_diagnose(sample_dataset, sample_model, tmp_storage, monkeypatch):
    ds, model, settings = make_dataset_model(sample_dataset, sample_model, tmp_storage)

    class R:
        content = '{"summary":"ok","risks":["r1"],"recommendations":["c1"]}'

    # Patch ChatOpenAI inside diagnose_service
    monkeypatch.setattr("app.services.diagnose_service.ChatOpenAI", lambda **_: (lambda *_args, **_kwargs: R()))

    result = diagnose(
        dataset=ds,
        model=model,
        settings=settings,
        sensitive_attribute="gender",
        privileged_values=["M"],
        unprivileged_values=["F"],
    )
    assert result.summary
    assert result.artifact_path.exists()


def test_report(sample_dataset, sample_model, tmp_storage, monkeypatch):
    ds, model, settings = make_dataset_model(sample_dataset, sample_model, tmp_storage)

    class R:
        content = '{"summary":"ok","risks":["r1"],"recommendations":["c1"]}'

    monkeypatch.setattr("app.services.diagnose_service.ChatOpenAI", lambda **_: (lambda *_args, **_kwargs: R()))

    report = generate_report(
        dataset=ds,
        model=model,
        settings=settings,
        sensitive_attribute="gender",
        privileged_values=["M"],
        unprivileged_values=["F"],
    )
    assert report.txt_path.exists()

