import logging
import logging.config
from typing import Any, Dict

import structlog

from app.core.config import Settings


def _structlog_config(level: str) -> Dict[str, Any]:
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "console": {
                "()": structlog.stdlib.ProcessorFormatter,
                "processor": structlog.dev.ConsoleRenderer(),
                "foreign_pre_chain": [
                    structlog.stdlib.add_log_level,
                    structlog.stdlib.add_logger_name,
                    structlog.stdlib.ExtraAdder(),
                    structlog.processors.TimeStamper(fmt="iso"),
                ],
            }
        },
        "handlers": {
            "default": {
                "level": level,
                "class": "logging.StreamHandler",
                "formatter": "console",
            }
        },
        "loggers": {"": {"handlers": ["default"], "level": level, "propagate": True}},
    }


def configure_logging(settings: Settings) -> None:
    """Configure structlog + stdlib logging."""

    logging.config.dictConfig(_structlog_config(settings.log_level))
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.ExtraAdder(),
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(settings.log_level)),
        cache_logger_on_first_use=True,
    )