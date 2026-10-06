from __future__ import annotations

from fastapi import FastAPI

from . import logging_setup
from .config import DATA_DIR, load_providers
from .logging_setup import log_event

logging_setup.configure()

app = FastAPI(title="Text Scrapbook ML service", version="0.1.0")
providers = load_providers()
DATA_DIR.mkdir(parents=True, exist_ok=True)
log_event("startup", preset=providers.preset, **{p.role: p.name for p in providers.all()})


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "preset": providers.preset,
        "providers": {p.role: p.name for p in providers.all()},
    }


@app.get("/providers")
def describe_providers() -> dict:
    """Everything the UI needs for the cloud opt-in disclosure: which roles
    send data off the machine, what they send, and to whom."""
    described = [p.describe() for p in providers.all()]
    return {
        "preset": providers.preset,
        "providers": described,
        "any_cloud": any(p["is_cloud"] for p in described),
    }
