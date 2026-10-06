"""Logging that records ids and errors only, never message text.

Call `log_event(name, **ids)` with ids, counts, and statuses. Any field whose
name suggests content is dropped before it reaches a handler.
"""

import logging

_CONTENT_KEYS = {"text", "message", "messages", "quote", "quotes", "caption", "summary", "prompt", "content", "body"}

logger = logging.getLogger("scrapbook.ml")


def configure() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


def log_event(event: str, **fields: object) -> None:
    safe = {k: v for k, v in fields.items() if k.lower() not in _CONTENT_KEYS}
    dropped = len(fields) - len(safe)
    if dropped:
        safe["redacted_fields"] = dropped
    logger.info("%s %s", event, " ".join(f"{k}={v}" for k, v in safe.items()))
