"""Specialized agent for analyzing model performance metrics with advanced reasoning."""

from __future__ import annotations

from typing import Any

from app.ai.agents.base_agent import AgentResponse, BaseAgent
from app.core.config import Settings


class MetricsAgent(BaseAgent):
    """Agent specialized in analyzing model performance metrics."""

    def __init__(self, settings: Settings):
        system_prompt = """You are an expert ML evaluation agent specializing in model performance analysis.
Your role is to:
1. Analyze performance metrics (accuracy, precision, recall, F1, ROC-AUC, PR-AUC, RMSE, MAE, R²)
2. Identify potential issues (overfitting, underfitting, class imbalance, data leakage)
3. Assess metric quality relative to problem type and dataset characteristics
4. Provide actionable recommendations for improvement
5. Flag metrics that require deeper investigation

Be precise, data-driven, and focus on actionable insights."""
        super().__init__(settings, "MetricsAgent", system_prompt)

    def analyze(self, context: dict[str, Any]) -> AgentResponse:
        """Analyze metrics and provide structured findings."""
        metrics = context.get("metrics", {})
        problem_type = context.get("problem_type", "unknown")
        n_samples = context.get("n_samples", 0)
        n_features = context.get("n_features", 0)
        n_classes = context.get("n_classes")

        user_prompt = f"""Analyze the following model performance metrics:

**Problem Type**: {problem_type}
**Dataset Size**: {n_samples} samples, {n_features} features
**Number of Classes**: {n_classes if n_classes else 'N/A'}

**Metrics**:
{self._format_metrics(metrics, problem_type)}

Provide:
1. A concise summary of model performance
2. Confidence level (0.0-1.0) in your assessment
3. Key findings (potential issues, strengths, anomalies)
4. Specific recommendations for improvement
5. Whether deeper analysis is needed (e.g., calibration, adversarial testing)"""

        return self._invoke_llm(user_prompt)

    def _format_metrics(self, metrics: dict[str, Any], problem_type: str) -> str:
        """Format metrics for LLM prompt."""
        lines = []
        if problem_type == "classification":
            for key in ["accuracy", "f1_macro", "precision", "recall", "roc_auc", "pr_auc"]:
                if key in metrics and metrics[key] is not None:
                    lines.append(f"- {key}: {metrics[key]:.4f}" if isinstance(metrics[key], (int, float)) else f"- {key}: {metrics[key]}")
        else:
            for key in ["rmse", "mae", "r2"]:
                if key in metrics and metrics[key] is not None:
                    lines.append(f"- {key}: {metrics[key]:.4f}" if isinstance(metrics[key], (int, float)) else f"- {key}: {metrics[key]}")
        return "\n".join(lines) if lines else "No metrics available"

