"""Produce and verify the nightly backup artifacts.

The Pi-only orchestration (git, flock, the run log, the systemd timer) lives in
``scripts/backup.sh``; this module holds the testable, correctness-critical logic:

1. a transactionally consistent copy of the live SQLite database,
2. a SQLite integrity check on that copy, and
3. a full-history JSON export (the same privacy-bounded payload Claude reads),
   verified to re-parse before it is written.

Any failure raises :class:`BackupError`. Only the CLI :func:`main` converts that into
a non-zero exit, so the shell orchestrator can detect, log, and avoid committing a bad
artifact over good history (FR-002, FR-004a, FR-008).
"""

import argparse
import json
import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path

from claude_context import build_budget_context
from config import settings

EXPORT_SCHEMA_VERSION = 1


class BackupError(Exception):
    """Raised when a backup step fails. The CLI turns this into a non-zero exit."""


def copy_database(src_path: str | Path, dst_path: str | Path) -> None:
    """Write a transactionally consistent copy of the live DB to ``dst_path``.

    Uses the SQLite online-backup API rather than a raw file copy so a concurrent
    write cannot produce a torn read (FR-002). A missing or zero-length source is
    rejected up front — otherwise ``sqlite3.connect`` would silently create an empty
    database and we would back up garbage over a good history (FR-009).

    Direct ``sqlite3`` is used here because a consistent online copy is a database
    maintenance operation with no SQLAlchemy ORM equivalent (constitution Principle
    III "genuinely inapplicable" exception).
    """
    src = Path(src_path)
    if not src.is_file() or src.stat().st_size == 0:
        raise BackupError(f"source database missing or empty: {src}")

    source = sqlite3.connect(src)
    try:
        dest = sqlite3.connect(Path(dst_path))
        try:
            source.backup(dest)
        finally:
            dest.close()
    finally:
        source.close()


def verify_integrity(db_path: str | Path) -> None:
    """Raise :class:`BackupError` unless ``PRAGMA integrity_check`` returns a single ``ok``.

    Direct ``sqlite3`` maintenance call (see :func:`copy_database`) — no ORM equivalent.
    A malformed file may also fail to open, which is treated as a failed check.
    """
    conn = sqlite3.connect(Path(db_path))
    try:
        result = conn.execute("PRAGMA integrity_check").fetchall()
    except sqlite3.DatabaseError as exc:
        raise BackupError(f"integrity check could not run: {exc}") from exc
    finally:
        conn.close()

    if result != [("ok",)]:
        raise BackupError(f"integrity check failed: {result}")


def build_export(session) -> dict:
    """Wrap the full-history financial picture in the export envelope.

    ``data`` is exactly ``build_budget_context`` — the single source of truth for the
    household's financial picture — so the export and the Claude payload never drift
    (FR-004). The envelope adds only an export timestamp and a schema version; it never
    contains secrets, the PIN, or the API key (those live in the environment, not the DB).
    """
    return {
        "exported_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "schema_version": EXPORT_SCHEMA_VERSION,
        "data": build_budget_context(session),
    }


def write_export(export: dict, json_out: str | Path) -> None:
    """Serialise the export, confirm it re-parses, then write it.

    The round-trip parse guarantees a malformed export is rejected before it can be
    committed over good history (FR-004a). Nothing is written if it does not parse.
    """
    serialised = json.dumps(export, indent=2)
    try:
        json.loads(serialised)
    except json.JSONDecodeError as exc:
        raise BackupError(f"generated JSON did not parse: {exc}") from exc
    Path(json_out).write_text(serialised, encoding="utf-8")


def run_backup(*, src_path: str | Path, db_out: str | Path, json_out: str | Path, session) -> None:
    """The full routine: consistent copy → integrity check → export → JSON verify."""
    copy_database(src_path, db_out)
    verify_integrity(db_out)
    write_export(build_export(session), json_out)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Produce and verify the budget backup artifacts.")
    parser.add_argument("--db-out", required=True, help="Destination path for the DB copy")
    parser.add_argument("--json-out", required=True, help="Destination path for the JSON export")
    args = parser.parse_args(argv)

    try:
        # Copy + verify the DB before opening a session, so a missing/corrupt source
        # fails fast (and we never touch the live database when the source is bad).
        copy_database(settings.database_url, args.db_out)
        verify_integrity(args.db_out)

        from database import SessionLocal

        with SessionLocal() as session:
            export = build_export(session)
        write_export(export, args.json_out)
    except BackupError as exc:
        print(f"backup failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
