"""PIN gate endpoints (Phase 5, US1).

The PIN is verified server-side so its value never ships in the client bundle
(FR-005a). A wrong PIN is a normal negative result (``200 {"ok": false}``), not
an HTTP error, so the frontend can tell "wrong PIN" apart from "server down".
"""

import pytest
from config import settings


@pytest.fixture
def pin(monkeypatch):
    """Configure a PIN for the duration of one test."""

    def _set(value: str) -> str:
        monkeypatch.setattr(settings, "app_pin", value)
        return value

    return _set


# ---------------------------------------------------------------------------
# POST /api/verify-pin
# ---------------------------------------------------------------------------
def test_correct_pin_is_accepted(client, pin):
    pin("1234")
    res = client.post("/api/verify-pin", json={"pin": "1234"})
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_wrong_pin_is_rejected_without_an_http_error(client, pin):
    pin("1234")
    res = client.post("/api/verify-pin", json={"pin": "9999"})
    assert res.status_code == 200
    assert res.json() == {"ok": False}


def test_pin_comparison_is_exact(client, pin):
    """No prefix/whitespace slack — only the exact value unlocks."""
    pin("1234")
    for attempt in ("123", "12345", " 1234", "1234 ", ""):
        assert client.post("/api/verify-pin", json={"pin": attempt}).json() == {"ok": False}


def test_verify_pin_400_when_no_pin_configured(client, pin):
    pin("")
    res = client.post("/api/verify-pin", json={"pin": "1234"})
    assert res.status_code == 400


def test_verify_pin_422_on_malformed_body(client, pin):
    pin("1234")
    assert client.post("/api/verify-pin", json={}).status_code == 422
    assert client.post("/api/verify-pin", json={"pin": 1234}).status_code == 422


# ---------------------------------------------------------------------------
# GET /api/pin-required
# ---------------------------------------------------------------------------
def test_pin_required_true_when_configured(client, pin):
    pin("1234")
    res = client.get("/api/pin-required")
    assert res.status_code == 200
    assert res.json() == {"required": True}


def test_pin_required_false_when_blank(client, pin):
    pin("")
    res = client.get("/api/pin-required")
    assert res.status_code == 200
    assert res.json() == {"required": False}


def test_pin_required_never_reveals_the_pin(client, pin):
    """The gate tells the frontend *whether* to lock, never the secret itself."""
    pin("4321")
    assert "4321" not in client.get("/api/pin-required").text
