"""Unit tests for the Python backup module (backend/backup.py).

These cover the correctness-critical logic: a consistent DB copy, integrity
verification, the JSON export envelope, JSON-parse verification, the empty-DB
case, the secrets guard, and the missing/zero-length source guard. The shell
orchestrator and systemd timer are Pi-only and verified manually (FR-014).
"""

import json
import sqlite3
from datetime import datetime

import backup
import pytest
from database import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def test_consistent_copy_roundtrip(seeded_db, tmp_path):
    """copy_database produces a valid SQLite file containing the seeded data (T004)."""
    dst = tmp_path / "copy.db"
    backup.copy_database(seeded_db.db_path, dst)

    assert dst.exists()
    conn = sqlite3.connect(dst)
    try:
        labels = [row[0] for row in conn.execute("SELECT label FROM income_entries")]
    finally:
        conn.close()
    assert "Ryan salary" in labels


def test_integrity_check_detects_corruption(seeded_db, tmp_path):
    """A truncated/corrupt copy fails the integrity check by raising, not exiting (T005)."""
    copy = tmp_path / "copy.db"
    backup.copy_database(seeded_db.db_path, copy)

    # Truncate the copy mid-file to simulate corruption.
    with open(copy, "r+b") as fh:
        fh.truncate(100)

    with pytest.raises(backup.BackupError):
        backup.verify_integrity(copy)


def test_export_envelope_shape(seeded_db):
    """build_export wraps build_budget_context in the documented envelope (T006)."""
    export = backup.build_export(seeded_db.session)

    assert set(export.keys()) == {"exported_at", "schema_version", "data"}
    assert export["schema_version"] == 1

    # exported_at is a valid UTC ISO-8601 string ending in Z.
    assert export["exported_at"].endswith("Z")
    parsed = datetime.fromisoformat(export["exported_at"].replace("Z", "+00:00"))
    assert parsed.tzinfo is not None

    data = export["data"]
    for key in ("months", "accounts", "balance_snapshots", "amendments"):
        assert key in data


def test_json_verify_rejects_malformed_json(seeded_db, tmp_path, monkeypatch):
    """write_export raises (and writes nothing) if the serialised JSON does not parse (T007)."""
    export = backup.build_export(seeded_db.session)
    json_out = tmp_path / "export.json"

    # Force serialisation to emit invalid JSON.
    monkeypatch.setattr(backup.json, "dumps", lambda *a, **k: "{not valid json")

    with pytest.raises(backup.BackupError):
        backup.write_export(export, json_out)

    assert not json_out.exists()


def test_empty_db_backup_succeeds(tmp_path):
    """A schema-only empty DB backs up cleanly: both artifacts valid (T008)."""
    src = tmp_path / "empty.db"
    eng = create_engine(
        f"sqlite:///{src}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=eng)
    session = sessionmaker(bind=eng)()

    db_out = tmp_path / "out.db"
    json_out = tmp_path / "out.json"
    try:
        backup.run_backup(src_path=src, db_out=db_out, json_out=json_out, session=session)
    finally:
        session.close()
        eng.dispose()

    assert db_out.exists() and json_out.exists()
    backup.verify_integrity(db_out)  # must not raise
    parsed = json.loads(json_out.read_text())
    assert parsed["data"]["months"] == []


def test_no_secrets_in_export(seeded_db):
    """The serialised export never contains secrets, the PIN, or the API key (T009)."""
    export = backup.build_export(seeded_db.session)
    serialised = json.dumps(export)

    for forbidden in ("ANTHROPIC_API_KEY", "APP_PIN", "sk-ant", ".env"):
        assert forbidden not in serialised


def test_missing_source_db_fails(tmp_path, monkeypatch):
    """A missing or zero-length source DB fails loudly; the CLI exits non-zero (T009a)."""
    missing = tmp_path / "missing.db"
    with pytest.raises(backup.BackupError):
        backup.copy_database(missing, tmp_path / "out1.db")

    zero = tmp_path / "zero.db"
    zero.touch()  # zero-length file
    with pytest.raises(backup.BackupError):
        backup.copy_database(zero, tmp_path / "out2.db")

    # The CLI converts the failure into exit code 1 (our deliberate failure exit,
    # distinct from argparse's exit 2) and opens no session.
    monkeypatch.setattr(backup.settings, "database_url", str(missing))
    with pytest.raises(SystemExit) as exc_info:
        backup.main(["--db-out", str(tmp_path / "o.db"), "--json-out", str(tmp_path / "o.json")])
    assert exc_info.value.code == 1


def test_main_writes_and_verifies_both_artifacts(seeded_db, tmp_path, monkeypatch):
    """The CLI success path writes a verified DB copy and a parseable JSON export."""
    db_out = tmp_path / "out.db"
    json_out = tmp_path / "out.json"

    monkeypatch.setattr(backup.settings, "database_url", str(seeded_db.db_path))
    fake_factory = sessionmaker(
        bind=create_engine(
            f"sqlite:///{seeded_db.db_path}",
            connect_args={"check_same_thread": False},
        )
    )
    monkeypatch.setattr("database.SessionLocal", fake_factory)

    backup.main(["--db-out", str(db_out), "--json-out", str(json_out)])

    assert db_out.exists() and json_out.exists()
    backup.verify_integrity(db_out)  # must not raise
    parsed = json.loads(json_out.read_text())
    assert any(month["month"] == "2026-06" for month in parsed["data"]["months"])


@pytest.mark.parametrize("argv", [["--db-out", "x"], ["--json-out", "y"], []])
def test_main_requires_both_output_args(argv):
    """Both --db-out and --json-out are required (contract §A): a missing one is an
    argparse usage error (exit 2) before any backup work runs."""
    with pytest.raises(SystemExit) as exc_info:
        backup.main(argv)
    assert exc_info.value.code == 2
