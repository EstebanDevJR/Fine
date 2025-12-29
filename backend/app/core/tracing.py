from __future__ import annotations

from typing import Any

from app.core.config import Settings

try:  # pragma: no cover - optional dependency
    from langfuse import Langfuse
except ImportError:  # pragma: no cover
    Langfuse = None  # type: ignore


class _NoopSpan:
    def end(self, **_: Any) -> None:
        return


class _NoopTrace:
    def span(self, *_: Any, **__: Any) -> _NoopSpan:
        return _NoopSpan()

    def end(self, **_: Any) -> None:
        return


class _SpanWrapper:
    def __init__(self, span: Any) -> None:
        self._span = span

    def end(self, output: Any | None = None, error: str | None = None) -> None:
        payload: dict[str, Any] = {}
        if output is not None:
            payload["output"] = output
        if error is not None:
            payload["status_message"] = error
        self._span.end(**payload)


class TraceWrapper:
    """Light wrapper so that callers can ignore Langfuse being optional."""

    def __init__(self, trace: Any) -> None:
        self._trace = trace

    def span(
        self, name: str, input: Any | None = None, metadata: dict[str, Any] | None = None
    ) -> _SpanWrapper:
        span = self._trace.span(name=name, input=input, metadata=metadata)
        return _SpanWrapper(span)

    def end(self, **kwargs: Any) -> None:
        self._trace.end(**kwargs)


def build_trace(
    settings: Settings,
    name: str,
    input: Any | None = None,
    metadata: dict[str, Any] | None = None,
) -> TraceWrapper | _NoopTrace:
    """Return a TraceWrapper if Langfuse is configured, otherwise a noop trace."""
    if Langfuse is None:
        return _NoopTrace()
    if not settings.langfuse_public_key or not settings.langfuse_secret_key:
        return _NoopTrace()

    client = Langfuse(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_host,
    )
    trace = client.trace(name=name, input=input, metadata=metadata)
    return TraceWrapper(trace)
