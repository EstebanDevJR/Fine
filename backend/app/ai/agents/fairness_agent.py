"""Specialized agent for analyzing fairness and bias in ML models."""

from __future__ import annotations

from typing import Any

from app.ai.agents.base_agent import AgentResponse, BaseAgent
from app.core.config import Settings


class FairnessAgent(BaseAgent):
    """Agent specialized in fairness and bias analysis."""

    def __init__(self, settings: Settings):
        system_prompt = """You are an expert ML fairness agent specializing in:
1. Demographic parity, equalized odds, and disparate impact analysis
2. Identifying bias patterns across protected groups
3. Assessing fairness metrics against industry standards (e.g., 80% rule)
4. Recommending bias mitigation strategies
5. Evaluating trade-offs between fairness and performance

Be sensitive to ethical implications and provide clear, actionable guidance."""
        super().__init__(settings, "FairnessAgent", system_prompt)

    def analyze(self, context: dict[str, Any]) -> AgentResponse:
        """Analyze fairness metrics."""
        fairness_data = context.get("fairness", {})
        sensitive_attribute = context.get("sensitive_attribute", "unknown")

        user_prompt = f"""Analyze the following fairness metrics:

**Protected Attribute**: {sensitive_attribute}

**Fairness Metrics**:
- Demographic Parity Difference: {fairness_data.get('demographic_parity_diff', 'N/A')}
- Disparate Impact Ratio: {fairness_data.get('disparate_impact', 'N/A')}
- Equal Opportunity Difference: {fairness_data.get('equal_opportunity_diff', 'N/A')}
- Predictive Equality Difference: {fairness_data.get('predictive_equality_diff', 'N/A')}

**Context**: 
- Privileged values: {context.get('privileged_values', [])}
- Unprivileged values: {context.get('unprivileged_values', [])}

Provide:
1. Summary of fairness assessment
2. Confidence in fairness evaluation
3. Findings (bias patterns, violations of fairness criteria)
4. Recommendations (mitigation strategies, threshold adjustments)
5. Whether additional fairness analysis is needed (e.g., intersectional analysis)"""

        return self._invoke_llm(user_prompt)

