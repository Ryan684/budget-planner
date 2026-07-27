"""Nightly-backup health derived from the Phase 4 run log (Phase 5, US3).

The log is the contract with ``scripts/backup.sh``: one ``[<ISO-8601 UTC>]
SUCCESS`` or ``[<ISO-8601 UTC>] FAILED: <reason>`` line per run. Anything the
parser cannot read is "unknown" — never a false failure banner (FR-016).
"""

from datetime import UTC, datetime, timedelta

import backup_status
import pytest
from config import settings


@pytest.fixture
def log_file(tmp_path, monkeypatch):
    """Write a backup log and point the settings at it."""

    def _write(content: str | None, *, stale_hours: int = 36) -> None:
        monkeypatch.setattr(settings, "backup_stale_hours", stale_hours)
        if content is None:
            monkeypatch.setattr(settings, "backup_log_file", str(tmp_path / "missing.log"))
            return
        path = tmp_path / "budget-backup.log"
        path.write_text(content)
        monkeypatch.setattr(settings, "backup_log_file", str(path))

    return _write


def stamp(hours_ago: float) -> str:
    return (datetime.now(UTC) - timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------
def test_reads_a_recent_success(log_file):
    log_file(f"[{stamp(2)}] SUCCESS\n")

    result = backup_status.read_status()

    assert result.status == "success"
    assert result.stale is False
    assert result.last_run_at is not None


def test_reads_a_failure_with_a_reason(log_file):
    log_file(f"[{stamp(2)}] FAILED: git push\n")

    result = backup_status.read_status()

    assert result.status == "failed"
    assert result.last_run_at is not None


def test_the_last_logged_run_wins(log_file):
    log_file(f"[{stamp(30)}] SUCCESS\n[{stamp(20)}] FAILED: git push\n[{stamp(2)}] SUCCESS\n")

    assert backup_status.read_status().status == "success"


def test_a_later_failure_supersedes_an_earlier_success(log_file):
    log_file(f"[{stamp(26)}] SUCCESS\n[{stamp(2)}] FAILED: integrity check\n")

    assert backup_status.read_status().status == "failed"


def test_the_timestamp_is_parsed_as_utc(log_file):
    log_file("[2026-07-26T02:30:00Z] SUCCESS\n")

    result = backup_status.read_status()

    assert result.last_run_at == datetime(2026, 7, 26, 2, 30, tzinfo=UTC)


def test_a_partial_last_line_falls_back_to_the_last_complete_one(log_file):
    """A run writing its line while we read must not blank out the status."""
    log_file(f"[{stamp(2)}] SUCCESS\n[2026-07-27T02:3")

    result = backup_status.read_status()

    assert result.status == "success"


def test_unrelated_lines_are_ignored(log_file):
    log_file(f"starting backup\n[{stamp(2)}] SUCCESS\nsome trailing noise\n")

    assert backup_status.read_status().status == "success"


# ---------------------------------------------------------------------------
# Staleness
# ---------------------------------------------------------------------------
def test_a_success_older_than_the_threshold_is_stale(log_file):
    log_file(f"[{stamp(40)}] SUCCESS\n", stale_hours=36)

    result = backup_status.read_status()

    assert result.status == "success"
    assert result.stale is True


def test_a_success_inside_the_threshold_is_not_stale(log_file):
    log_file(f"[{stamp(25)}] SUCCESS\n", stale_hours=36)

    assert backup_status.read_status().stale is False


def test_the_threshold_is_configurable(log_file):
    log_file(f"[{stamp(25)}] SUCCESS\n", stale_hours=12)

    assert backup_status.read_status().stale is True


def test_a_failure_is_never_reported_as_stale(log_file):
    """A failure already warrants a banner; staleness only qualifies a success."""
    log_file(f"[{stamp(200)}] FAILED: git push\n")

    result = backup_status.read_status()

    assert result.status == "failed"
    assert result.stale is False


# ---------------------------------------------------------------------------
# Degradation (FR-016) — never a false alarm
# ---------------------------------------------------------------------------
def test_blank_log_setting_is_unknown(monkeypatch):
    monkeypatch.setattr(settings, "backup_log_file", "")

    result = backup_status.read_status()

    assert result.status == "unknown"
    assert result.last_run_at is None
    assert result.stale is False


def test_missing_file_is_unknown(log_file):
    log_file(None)

    result = backup_status.read_status()

    assert result.status == "unknown"
    assert result.last_run_at is None
    assert result.stale is False


def test_empty_file_is_unknown(log_file):
    log_file("")

    assert backup_status.read_status().status == "unknown"


def test_unparseable_log_is_unknown(log_file):
    log_file("backup started\nsomething went sideways\n")

    result = backup_status.read_status()

    assert result.status == "unknown"
    assert result.stale is False


def test_a_malformed_timestamp_is_unknown(log_file):
    log_file("[not-a-timestamp] SUCCESS\n")

    assert backup_status.read_status().status == "unknown"


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------
def test_endpoint_returns_the_status_payload(client, log_file):
    log_file(f"[{stamp(2)}] SUCCESS\n")

    res = client.get("/api/backup-status")

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["stale"] is False
    assert body["last_run_at"] is not None


def test_endpoint_returns_200_unknown_when_no_log_exists(client, monkeypatch):
    monkeypatch.setattr(settings, "backup_log_file", "")

    res = client.get("/api/backup-status")

    assert res.status_code == 200
    assert res.json() == {"status": "unknown", "last_run_at": None, "stale": False}
