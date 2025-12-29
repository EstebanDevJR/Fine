from __future__ import annotations

from typing import TypedDict


class AuditGraphState(TypedDict, total=False):
    results: dict


def run_overfit(state: AuditGraphState) -> AuditGraphState:
    results = state.get("results", {})
    metrics_block = results.get("metrics", {})
    metrics = metrics_block.get("metrics", {}) if isinstance(metrics_block, dict) else {}

    flags = []
    acc = metrics.get("accuracy") or metrics.get("acc")
    if acc is not None and isinstance(acc, int | float) and acc >= 0.98:
        flags.append("Very high accuracy; check for potential overfitting or leakage.")

    if flags:
        results["overfit"] = {"flags": flags}
    else:
        results["overfit"] = {"flags": []}
    return {**state, "results": results}
