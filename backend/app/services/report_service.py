from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jinja2 import BaseLoader, Environment, select_autoescape

from app.core.config import Settings
from app.db.models import Dataset, ModelArtifact
from app.services.diagnose_service import diagnose
from app.services.fairness_service import evaluate_fairness
from app.services.metrics_service import evaluate_model
from app.services.stress_service import robustness_analysis, sensitivity_analysis
from app.services.xai_service import explain_model


@dataclass
class ReportResult:
    txt_path: Path


REPORT_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Model Audit Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2933; }
    h1, h2, h3 { color: #111827; }
    .section { margin-bottom: 24px; }
    .card { padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 8px; margin-top: 8px; }
    .muted { color: #6b7280; font-size: 0.95em; }
    ul { margin: 8px 0 8px 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
    th { background: #f3f4f6; }
    code { background: #f3f4f6; padding: 2px 4px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Model Audit Report</h1>
  <p class="muted">Dataset: {{ dataset.name }} — Model: {{ model.name }}</p>

  <div class="section">
    <h2>Summary</h2>
    <div class="card">
      <p>{{ diagnosis.summary }}</p>
    </div>
    <div class="card">
      <h3>Risks</h3>
      <ul>
        {% for r in diagnosis.risks %}<li>{{ r }}</li>{% endfor %}
        {% if diagnosis.risks|length == 0 %}<li>No explicit risks reported.</li>{% endif %}
      </ul>
      <h3>Recommendations</h3>
      <ul>
        {% for rec in diagnosis.recommendations %}<li>{{ rec }}</li>{% endfor %}
        {% if diagnosis.recommendations|length == 0 %}<li>No explicit recommendations reported.</li>{% endif %}
      </ul>
    </div>
  </div>

  <div class="section">
    <h2>Metrics ({{ metrics.problem_type }})</h2>
    <div class="card">
      <table>
        <tbody>
          {% for k,v in metrics.metrics.items() %}
            <tr><th>{{ k }}</th><td>{{ v }}</td></tr>
          {% endfor %}
        </tbody>
      </table>
      <p class="muted">Samples: {{ metrics.n_samples }}, Features: {{ metrics.n_features }}, Classes: {{ metrics.n_classes }}</p>
    </div>
  </div>

  <div class="section">
    <h2>Interpretability</h2>
    <div class="card">
      <h3>Permutation Importance (top)</h3>
      <table>
        <thead><tr><th>Feature</th><th>Mean</th><th>Std</th></tr></thead>
        <tbody>
          {% for item in xai.permutation_importance[:10] %}
            <tr><td>{{ item.feature }}</td><td>{{ item.importance_mean }}</td><td>{{ item.importance_std }}</td></tr>
          {% endfor %}
        </tbody>
      </table>
      <h3>SHAP (global mean abs)</h3>
      <ul>
        {% for name,val in shap_pairs %}
          <li><code>{{ name }}</code>: {{ val }}</li>
        {% endfor %}
      </ul>
    </div>
  </div>

  <div class="section">
    <h2>Sensitivity & Robustness</h2>
    <div class="card">
      <h3>Sensitivity</h3>
      <p>Label flip rate: {{ sensitivity.label_flip_rate }}, Proba shift mean: {{ sensitivity.proba_shift_mean }}</p>
      <h3>Robustness</h3>
      <p>Metric drop (noise): {{ robustness.metric_drop }}</p>
      <p>Missing feature impact: {{ robustness.missing_feature_impact }}</p>
    </div>
  </div>

  {% if fairness %}
  <div class="section">
    <h2>Fairness</h2>
    <div class="card">
      <table>
        <tbody>
          <tr><th>Demographic parity diff</th><td>{{ fairness.demographic_parity_diff }}</td></tr>
          <tr><th>Disparate impact</th><td>{{ fairness.disparate_impact }}</td></tr>
          <tr><th>Equal opportunity diff</th><td>{{ fairness.equal_opportunity_diff }}</td></tr>
          <tr><th>Predictive equality diff</th><td>{{ fairness.predictive_equality_diff }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  {% endif %}

</body>
</html>
"""


@dataclass
class RenderContext:
    dataset: dict[str, Any]
    model: dict[str, Any]
    metrics: dict[str, Any]
    xai: dict[str, Any]
    shap_pairs: list
    sensitivity: dict[str, Any]
    robustness: dict[str, Any]
    fairness: dict[str, Any] | None
    diagnosis: dict[str, Any]


def _render_html(context: RenderContext) -> str:
    env = Environment(loader=BaseLoader(), autoescape=select_autoescape())
    template = env.from_string(REPORT_TEMPLATE)
    return template.render(
        dataset=context.dataset,
        model=context.model,
        metrics=context.metrics,
        xai=context.xai,
        shap_pairs=context.shap_pairs,
        sensitivity=context.sensitivity,
        robustness=context.robustness,
        fairness=context.fairness,
        diagnosis=context.diagnosis,
    )


def generate_report(
    *,
    dataset: Dataset,
    model: ModelArtifact,
    settings: Settings,
    sensitive_attribute: str | None = None,
    privileged_values: list[Any] | None = None,
    unprivileged_values: list[Any] | None = None,
    positive_label: int | float | str = 1,
) -> ReportResult:
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
        fairness_payload = fairness_res

    diagnosis_res = diagnose(
        dataset=dataset,
        model=model,
        settings=settings,
        sensitive_attribute=sensitive_attribute,
        privileged_values=privileged_values or [],
        unprivileged_values=unprivileged_values or [],
        positive_label=positive_label,
    )

    shap_pairs = list(
        zip(
            xai_res.shap_summary.get("feature_names", []),
            xai_res.shap_summary.get("global_mean_abs", []),
            strict=False,
        )
    )

    # Note: we previously built a RenderContext for templated reports; TXT report is generated below.

    import time
    from datetime import datetime

    from app.core.metrics import incr, observe_time

    t_start = time.perf_counter()

    # Generate markdown report text
    report_lines = []
    report_lines.append("# MODEL AUDIT REPORT")
    report_lines.append("=" * 80)
    report_lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report_lines.append("")
    report_lines.append(f"Dataset: {dataset.name}")
    report_lines.append(f"Model: {model.name}")
    report_lines.append("")
    report_lines.append("## 1. EXECUTIVE SUMMARY")
    report_lines.append("")
    if diagnosis_res.summary:
        report_lines.append(diagnosis_res.summary)
    else:
        report_lines.append(
            "This report presents a comprehensive analysis of the machine learning model performance, interpretability, robustness, and fairness characteristics."
        )
    report_lines.append("")

    # Dataset characteristics
    report_lines.append("## 2. DATASET CHARACTERISTICS")
    report_lines.append("")
    report_lines.append(f"Number of samples: {metrics_res.n_samples}")
    report_lines.append(f"Number of features: {metrics_res.n_features}")
    report_lines.append(f"Number of classes: {metrics_res.n_classes}")
    report_lines.append(f"Problem type: {metrics_res.problem_type}")
    report_lines.append("")

    # Metrics
    report_lines.append("## 3. MODEL PERFORMANCE METRICS")
    report_lines.append("")
    for key, value in metrics_res.metrics.items():
        if isinstance(value, int | float):
            report_lines.append(f"{key}: {value:.4f}")
        else:
            report_lines.append(f"{key}: {value}")
    report_lines.append("")

    # XAI
    report_lines.append("## 4. MODEL INTERPRETABILITY")
    report_lines.append("")
    report_lines.append("### Permutation Importance (Top 10):")
    for item in xai_res.permutation_importance[:10]:
        feature = item.get("feature", "unknown")
        importance_mean = item.get("importance_mean", 0.0)
        importance_std = item.get("importance_std", 0.0)
        report_lines.append(f"  - {feature}: {importance_mean:.4f} (std: {importance_std:.4f})")
    report_lines.append("")
    report_lines.append("### SHAP Global Mean |Absolute|:")
    for name, val in shap_pairs[:10]:
        val_formatted = (
            f"{val:.4f}"
            if val is not None and not (isinstance(val, float) and (val != val))
            else "N/A"
        )
        report_lines.append(f"  - {name}: {val_formatted}")
    report_lines.append("")

    # Sensitivity & Robustness
    report_lines.append("## 5. MODEL RESILIENCE (ROBUSTNESS & SENSITIVITY)")
    report_lines.append("")
    report_lines.append("### Sensitivity Analysis:")
    label_flip = sens_res.label_flip_rate if sens_res.label_flip_rate is not None else 0.0
    proba_shift = sens_res.proba_shift_mean if sens_res.proba_shift_mean is not None else 0.0
    report_lines.append(f"  - Label Flip Rate: {label_flip:.4f}")
    report_lines.append(f"  - Probability Shift Mean: {proba_shift:.4f}")
    report_lines.append("")
    report_lines.append("### Robustness Analysis:")
    metric_drop = rob_res.metric_drop if rob_res.metric_drop is not None else 0.0
    report_lines.append(f"  - Metric Drop (Noise): {metric_drop:.4f}")
    if isinstance(rob_res.missing_feature_impact, dict):
        missing_drop = rob_res.missing_feature_impact.get("metric_drop")
        if missing_drop is not None:
            report_lines.append(f"  - Missing Feature Impact (Metric Drop): {missing_drop:.4f}")
        else:
            report_lines.append("  - Missing Feature Impact (Metric Drop): N/A")
    report_lines.append("")

    # Fairness
    if fairness_payload:
        report_lines.append("## 6. FAIRNESS ANALYSIS")
        report_lines.append("")
        dpd = (
            fairness_payload.demographic_parity_diff
            if fairness_payload.demographic_parity_diff is not None
            else 0.0
        )
        di = (
            fairness_payload.disparate_impact
            if fairness_payload.disparate_impact is not None
            else 0.0
        )
        eod = (
            fairness_payload.equal_opportunity_diff
            if fairness_payload.equal_opportunity_diff is not None
            else 0.0
        )
        ped = (
            fairness_payload.predictive_equality_diff
            if fairness_payload.predictive_equality_diff is not None
            else 0.0
        )
        report_lines.append(f"  - Demographic Parity Difference: {dpd:.4f}")
        report_lines.append(f"  - Disparate Impact: {di:.4f}")
        report_lines.append(f"  - Equal Opportunity Difference: {eod:.4f}")
        report_lines.append(f"  - Predictive Equality Difference: {ped:.4f}")
        report_lines.append("")

    # Risks
    if diagnosis_res.risks:
        report_lines.append("## 7. IDENTIFIED RISKS")
        report_lines.append("")
        for risk in diagnosis_res.risks:
            report_lines.append(f"  - {risk}")
        report_lines.append("")

    # Recommendations
    if diagnosis_res.recommendations:
        report_lines.append("## 8. RECOMMENDATIONS")
        report_lines.append("")
        for rec in diagnosis_res.recommendations:
            report_lines.append(f"  - {rec}")
        report_lines.append("")

    report_lines.append("## 9. CONCLUSION")
    report_lines.append("")
    report_lines.append(
        "This audit provides a detailed overview of the model's characteristics and performance. Addressing the identified risks and implementing the recommendations will enhance the model's reliability and fairness."
    )
    report_lines.append("")
    report_lines.append("=" * 80)
    report_lines.append("End of Report")

    # Write to text file
    txt_content = "\n".join(report_lines)
    settings.reports_path.mkdir(parents=True, exist_ok=True)
    txt_path = settings.reports_path / f"report_{uuid.uuid4().hex}.txt"
    txt_path.write_text(txt_content, encoding="utf-8")

    observe_time("report.ms", (time.perf_counter() - t_start) * 1000)
    incr("report.calls", 1)

    return ReportResult(txt_path=txt_path)
