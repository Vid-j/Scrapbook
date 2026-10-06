import logging

from fastapi.testclient import TestClient

from app.config import CONFIG_PATH, load_providers
from app.logging_setup import log_event
from app.main import app


def test_health_reports_local_preset():
    body = TestClient(app).get("/health").json()
    assert body["status"] == "ok"
    assert set(body["providers"]) == {"parser", "llm", "embedder", "imagegen"}


def test_local_preset_sends_nothing_off_machine():
    body = TestClient(app).get("/providers").json()
    if body["preset"] == "local":
        assert body["any_cloud"] is False


def test_cloud_preset_discloses_recipient(monkeypatch):
    monkeypatch.setenv("PROVIDERS_PRESET", "cloud")
    p = load_providers(CONFIG_PATH)
    assert p.parser.is_cloud and p.parser.recipient
    assert "screenshots" in p.parser.data_sent


def test_placeholder_imagegen_returns_art():
    img = load_providers(CONFIG_PATH).imagegen.generate("ignored", 64, 48)
    assert img.mime_type == "image/svg+xml" and img.provenance == "imagined"


def test_log_event_never_writes_message_text(caplog):
    with caplog.at_level(logging.INFO, logger="scrapbook.ml"):
        log_event("parsed", screenshot_id="s1", text="tiny umbrella secret", count=3)
    assert "tiny umbrella" not in caplog.text
    assert "screenshot_id=s1" in caplog.text
