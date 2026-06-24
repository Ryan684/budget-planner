# Contract: Backup CLI & Orchestrator

This feature exposes no HTTP API. Its external interfaces are (1) a Python CLI that produces the
verified artifacts and (2) a shell orchestrator invoked by a systemd timer. Both contracts below are
the source of truth for the tests and the Pi setup.

---

## A. `backend/backup.py` — Python CLI

**Invocation** (run from `backend/`, so module imports resolve via `pythonpath = ["."]`):

```bash
python backup.py --db-out <PATH> --json-out <PATH>
```

**Arguments**

| Arg | Required | Meaning |
|---|---|---|
| `--db-out` | yes | Destination path for the consistent DB copy (e.g. `$BACKUP_REPO_DIR/budget.db`) |
| `--json-out` | yes | Destination path for the JSON export (e.g. `$BACKUP_REPO_DIR/budget-export.json`) |

**Source**: the live DB at `settings.database_url` (existing config; no flag).

**Behaviour (in order)**
1. Create a transactionally consistent copy of the source DB to `--db-out` (SQLite online backup).
2. Run `PRAGMA integrity_check` on the copy; abort if the result is not a single `ok`.
3. Build the export envelope (`exported_at`, `schema_version`, `data` =
   `build_budget_context(session)`); serialise and confirm it re-parses; write to `--json-out`.
4. On success, both files exist and are verified.

**Exit codes**

| Code | Meaning |
|---|---|
| `0` | Both artifacts written and verified |
| non-zero | Any failure (source missing/empty, integrity check failed, JSON did not parse, write error). A short reason is written to **stderr**. No partial artifact is left in a "verified" state. |

**Guarantees**
- Read-only on the source DB (consistent snapshot; no writes, no schema change).
- Never prints or writes secrets, the PIN, or the API key.
- Deterministic JSON body (stable key order) for reproducible diffs and tests.

---

## B. `scripts/backup.sh` — shell orchestrator (Pi-only)

**Invocation**: by `budget-backup.service` (systemd `oneshot`), or manually on the Pi for testing.

**Environment** (from `.env.production`): `DATABASE_URL`, `BACKUP_REPO_DIR`, `BACKUP_LOG_FILE`,
`BACKUP_LOCK_FILE`. See data-model §4.

**Behaviour (in order)**
1. Acquire a non-blocking `flock` on `BACKUP_LOCK_FILE`; if held, exit non-zero (a run is in
   progress) without touching artifacts.
2. Run `backup.py --db-out "$BACKUP_REPO_DIR/budget.db" --json-out "$BACKUP_REPO_DIR/budget-export.json"`.
   On non-zero exit → log failure, exit non-zero.
3. In `BACKUP_REPO_DIR`: `git add budget.db budget-export.json` (explicit files only — FR-007).
4. If `git diff --cached --quiet` (nothing changed) → log SUCCESS, exit 0, **no commit** (FR-010).
5. Else `git commit -m "Backup <UTC ts>"` then `git push`. Any failure → log failure, exit non-zero,
   leave previous commit/history intact (no force-push) (FR-009).
6. Append the outcome line to `BACKUP_LOG_FILE` (FR-008).

**Exit codes**: `0` success (including the clean no-change case); non-zero on any failure.

**Guarantees**
- Single-instance via `flock`.
- Never rewrites or force-pushes history; a failed run cannot corrupt the last good backup.
- The local log always records the outcome, even when the push itself fails.

---

## C. systemd units

- `budget-backup.service` — `Type=oneshot`, `ExecStart=` the script, runs as the app user with the
  environment file loaded.
- `budget-backup.timer` — `OnCalendar=*-*-* 02:30:00`, `Persistent=true` (catch-up on next boot if a
  run was missed — FR-001), `WantedBy=timers.target`.
