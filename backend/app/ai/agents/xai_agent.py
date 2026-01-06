"""Specialized agent for analyzing explainability and feature importance."""

from __future__ import annotations

from typing import Any

from app.ai.agents.base_agent import AgentResponse, BaseAgent
from app.core.config import Settings


class XAIAgent(BaseAgent):
    """Agent specialized in explainability and feature importance analysis."""

    def __init__(self, settings: Settings):
        system_prompt = """You are an expert ML explainability agent specializing in:
1. Feature importance analysis (SHAP, Permutation Importance)
2. Model interpretability assessment
3. Identifying spurious correlations and feature dependencies
4. Evaluating explanation quality and consistency
5. Recommending improvements for model transparency

Focus on identifying which features drive predictions and whether explanations are trustworthy."""
        super().__init__(settings, "XAIAgent", system_prompt)

    def analyze(self, context: dict[str, Any]) -> AgentResponse:
        """Analyze explainability results."""
        xai_data = context.get("xai", {})
        permutation_importance = xai_data.get("permutation_importance", [])
        shap_summary = xai_data.get("shap_summary", {})

        user_prompt = f"""Analyze the following explainability results:

**Permutation Importance** (top 10):
{self._format_permutation_importance(permutation_importance[:10])}

**SHAP Summary**:
{self._format_shap_summary(shap_summary)}

Provide:
1. Summary of which features are most important and why
2. Confidence in explanation quality
3. Findings (e.g., unexpected feature importance, potential spurious correlations)
4. Recommendations (e.g., feature engineering, model simplification)
5. Whether additional explainability techniques are needed"""

        return self._invoke_llm(user_prompt)

    def _format_permutation_importance(self, perm_imp: list[dict[str, Any]]) -> str:
        """Format permutation importance for prompt."""
        if not perm_imp:
            return "No permutation importance data available"
        lines = []
        for item in perm_imp:
            feat = item.get("feature", "unknown")
            mean_imp = item.get("importance_mean", 0)
            std_imp = item.get("importance_std", 0)
            lines.append(f"- {feat}: {mean_imp:.4f} ± {std_imp:.4f}")
        return "\n".join(lines)

    def _format_shap_summary(self, shap_summary: dict[str, Any]) -> str:
        """Format SHAP summary for prompt."""
        if not shap_summary:
            return "No SHAP data available"
        lines = []
        if "global_mean_abs" in shap_summary:
            feat_names = shap_summary.get("feature_names", [])
            values = shap_summary.get("global_mean_abs", [])
            if feat_names and values:
                top_indices = sorted(range(len(values)), key=lambda i: abs(values[i]), reverse=True)[:10]
                lines.append("Top features by SHAP importance:")
                for idx in top_indices:
                    lines.append(f"- {feat_names[idx]}: {values[idx]:.4f}")
        if "per_class" in shap_summary:
            lines.append("\nPer-class SHAP values available")
        return "\n".join(lines) if lines else "SHAP data structure unclear"

