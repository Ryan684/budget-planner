"""Nightly-backup health, derived from the Phase 4 run log (Phase 5, US3).

``scripts/backup.sh`` appends one line per run:

    [2026-07-26T02:30:00Z] SUCCESS
    [2026-07-26T02:30:00Z] FAILED: git push

That format is the contract. This module reads the log named by
``BACKUP_LOG_FILE``, takes the last line that matches it, and reports the
outcome plus whether a successful run has gone stale.

Everything degrades to ``unknown`` — a blank setting (the dev default), a
missing or unreadable file, no parseable line, a bad timestamp. ``unknown``
shows no banner, so development never raises a false alarm (FR-016).
"""

import re
from dataclasses import dataclass
from datetime import UTC, datetime

from config import settings

# "[<ISO-8601 UTC>] SUCCESS" or "[<ISO-8601 UTC>] FAILED: <reason>".
_LINE = re.compile(r"^\[([0-9T:\-]+Z)\] (SUCCESS|FAILED)(:.*)?$")

UNKNOWN = "unknown"


@dataclass(frozen=True)
class BackupStatus:
    status: str
    last_run_at: datetime | None
    stale: bool


_UNKNOWN_STATUS = BackupStatus(status=UNKNOWN, last_run_at=None, stale=False)


def _read_lines() -> list[str] | None:
    if not settings.backup_log_file:
        return None
    try:
        with open(settings.backup_log_file, encoding="utf-8", errors="replace") as fh:
            return fh.read().splitlines()
    except OSError:
        return None


def _parse_timestamp(raw: str) -> datetime | None:
    try:
        return datetime.strptime(raw, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
    except ValueError:
        return None


def read_status(*, now: datetime | None = None) -> BackupStatus:
    """The most recent logged backup outcome, or ``unknown`` if it cannot be read."""
    lines = _read_lines()
    if lines is None:
        return _UNKNOWN_STATUS

    # Scan from the end so a partial line written mid-run falls back to the last
    # complete one rather than blanking the status.
    for line in reversed(lines):
        match = _LINE.match(line.strip())
        if match is None:
            continue
        last_run_at = _parse_timestamp(match.group(1))
        if last_run_at is None:
            continue
        succeeded = match.group(2) == "SUCCESS"
        age = (now or datetime.now(UTC)) - last_run_at
        # Staleness only qualifies a success — a failure already warrants a banner.
        stale = succeeded and age.total_seconds() > settings.backup_stale_hours * 3600
        return BackupStatus(
            status="success" if succeeded else "failed",
            last_run_at=last_run_at,
            stale=stale,
        )

    return _UNKNOWN_STATUS
