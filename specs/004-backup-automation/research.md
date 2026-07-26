# Phase 0 Research: Backup Automation

All decisions below were resolved from the spec + its 2026-06-24 clarifications, the project
constitution/`CLAUDE.md`, and the existing backend code. No open `NEEDS CLARIFICATION` items remain.

---

## 1. Consistent database copy

**Decision**: Use the SQLite **online backup API** via Python's stdlib `sqlite3`:
`sqlite3.connect(src).backup(sqlite3.connect(dest))`. The copy runs against the live database and
yields a transactionally consistent file even if the app writes concurrently.

**Rationale**: A plain `shutil.copy` of the `.db` file can capture a torn read mid-write (and is
unsafe with WAL). The online backup API is the SQLite-sanctioned way to snapshot a live database,
needs no new dependency, and is easy to unit-test (copy a seeded DB, assert the copy opens and
matches). Satisfies FR-002.

**Alternatives considered**: `VACUUM INTO 'dest'` (also consistent, but rewrites/defragments and is
slightly more surprising); `shutil.copy` (rejected — torn-read risk); `sqlite3` CLI `.backup` from
shell (rejected — moves logic out of the testable Python layer).

---

## 2. Backup integrity verification (FR-004a, SC-008)

**Decision**: After writing the copy, open it and run `PRAGMA integrity_check`; treat any result
other than the single row `ok` as failure. Separately, re-`json.loads` the JSON file just written
(or validate the serialised string before writing) to confirm it parses. If either check fails,
raise, write nothing further, and let the run fail (non-zero exit) — never commit/push.

**Rationale**: This is the whole point of the clarification — a silently corrupt artifact must be
rejected, not stored over good history. `integrity_check` is the standard SQLite soundness probe.
Both checks are pure, deterministic, and unit-testable (feed a deliberately truncated DB / malformed
JSON and assert failure).

**Alternatives considered**: `PRAGMA quick_check` (faster but less thorough — for a tiny nightly DB
the full check is cheap and stronger); trusting the backup API blindly (rejected — defeats FR-004a).

---

## 3. JSON export content & shape

**Decision**: Reuse `claude_context.build_budget_context(session)` as the export body — it already
assembles the **full multi-month** picture (all months' income/bills/surplus, all accounts,
`balance_snapshots`, and `amendments`) as a deterministic, stable-key-order dict. Wrap it with a
small metadata envelope: `{"exported_at": <UTC ISO8601>, "schema_version": 1, "data": {...}}`.

**Rationale**: DRY and correctness — the export and the Claude payload are the same "full financial
picture", so reusing one builder prevents drift and means existing tests already cover the body.
Matches FR-004 (full history, human-readable). The envelope gives a human/recovery reader the export
time and a version hook without coupling to app internals.

**Alternatives considered**: A bespoke export query (rejected — duplicates `build_budget_context` and
would drift); per-month files (rejected — one full-history file is simpler to read and restore from,
and the clarification chose full history); raw `iterdump()` SQL (rejected — not human-readable, and
the binary `.db` already covers SQL-level restore).

> Note: `build_budget_context` includes a computed `is_stale` flag per account. That is harmless and
> informative in a human-readable export, so it is kept as-is rather than stripped.

---

## 4. Stable filenames & avoiding repo bloat (FR-003)

**Decision**: Write exactly two artifacts into the backup repo working tree under fixed names:
`budget.db` and `budget-export.json`. Git history provides the dated versions. Stage them by
**explicit filename** (`git add budget.db budget-export.json`), never `git add -A`.

**Rationale**: Per the 2026-06-24 clarification — stable filename keeps the repo lean while commit
history is the version timeline. Explicit `git add` is also the secret-leak guard (FR-007): no stray
file (e.g. an accidentally-placed `.env`) can be committed. A committed `.gitignore` in the backup
repo additionally ignores everything except the two artifacts and the README.

**Alternatives considered**: Timestamped binaries per night (rejected by clarification — bloats git);
`git add -A` (rejected — secret-leak risk).

---

## 5. Scheduling with catch-up (FR-001)

**Decision**: A **systemd timer** (`budget-backup.timer`) with `OnCalendar=*-*-* 02:30:00` and
`Persistent=true`, triggering a `oneshot` service (`budget-backup.service`) that runs
`scripts/backup.sh`. `Persistent=true` runs the job on next boot if the scheduled time was missed
while the Pi was off.

**Rationale**: The clarification requires catch-up on next boot; plain cron cannot do this. The Pi
already runs the app under systemd (`budget-backend`/`budget-frontend`), so a timer is the native,
zero-extra-dependency fit and gives catch-up for free. **Divergence**: spec/`CLAUDE.md` say "cron";
this is logged in plan Complexity Tracking and the progress-log Spec Divergences table, to be
reconciled in the docs on merge.

**Alternatives considered**: `cron` (rejected — no catch-up); `anacron` (works, but adds a package
and a second scheduler alongside systemd); systemd timer **without** `Persistent` (rejected — would
silently skip a missed run).

---

## 6. Orchestration, locking, and the run log (FR-008, FR-009, FR-010)

**Decision**: `scripts/backup.sh` is a thin POSIX-shell orchestrator that:
1. Takes an exclusive `flock` on a lockfile (non-blocking) so overlapping runs cannot collide.
2. Runs `python backup.py --db-out "$REPO/budget.db" --json-out "$REPO/budget-export.json"` from
   `backend/` (which reads the source DB from `settings.database_url`). A non-zero exit aborts.
3. `git add` the two files; if `git diff --cached --quiet` reports no change, log success and exit 0
   **without** an empty commit (FR-010).
4. Otherwise `git commit -m "Backup <UTC timestamp>"` and `git push`.
5. Appends one line to the local log `$BACKUP_LOG_FILE` — `[<ts>] SUCCESS` or
   `[<ts>] FAILED: <stage/reason>` — and exits non-zero on any failure (FR-008).
6. On any failure (python verify, git, push) it leaves the previous good commit untouched (it never
   force-pushes and never rewrites history), so the next run recovers cleanly (FR-009).

**Rationale**: Keeping git/lock/log orchestration in shell — while all correctness logic lives in
the tested `backup.py` — is the simplest split that honours the constitution's test gates. The local
log (not repo-only) is the clarified requirement so that a *push* failure is still recorded offline.

**Alternatives considered**: Doing git in Python via `subprocess`/a git library (rejected — adds a
dependency or equivalent shell-out with no testability gain; shell is the idiomatic place for git +
flock + cron/systemd). Repo-committed log (rejected by clarification — can't record push failures).

---

## 7. Configuration & secrets boundary (FR-007, FR-013)

**Decision**: New environment values consumed **by the shell script** (read from
`.env.production` on the Pi), documented in the README:
- `BACKUP_REPO_DIR` — path to the cloned private backup repo working tree.
- `BACKUP_LOG_FILE` — path to the local run log.
- `BACKUP_LOCK_FILE` — path to the flock lockfile (default derivable).

The source DB path reuses the existing `DATABASE_URL`/`settings.database_url`. The Python module
takes only `--db-out`/`--json-out` as arguments; it never reads or emits secrets, the PIN, or the
API key (those live in the environment, not in the DB or the export). `config.py` needs **no** new
fields (the new vars are shell-only), keeping the app surface unchanged.

**Rationale**: Environment-driven config per `CLAUDE.md`; nothing hardcoded. Keeping the new vars in
shell (not `config.py`) avoids touching the running app for a Pi-ops concern. SSH auth to GitHub is
a Phase 0 / setup prerequisite (documented, not performed by the script).

**Alternatives considered**: Adding the paths to `config.py`/pydantic settings (rejected — the app
runtime doesn't use them; only the cron-invoked shell does).

---

## 8. Testing strategy (Constitution I & II)

**Decision**:
- **Gherkin first**: revise the stale `Feature: Backup` block in `docs/budget-planner.feature` to
  the clarified behaviour (full-history JSON, integrity verification, stable filename, local log,
  catch-up, recovery) before writing code.
- **pytest** (`backend/tests/test_backup.py`): consistent copy opens and round-trips a seeded DB;
  `integrity_check` failure is detected on a corrupted/truncated copy; export envelope wraps
  `build_budget_context` with `exported_at`/`schema_version`; JSON-verify rejects malformed JSON;
  empty-DB export and copy succeed; no secret/PIN/API-key fields appear in the export.
- **mutmut**: add `backup.py` to `[tool.mutmut] paths_to_mutate`; document any acceptable survivors
  in `MUTANTS.md`.
- **Pi-only manual** (FR-012/FR-014): run `scripts/backup.sh` on the Pi, confirm a commit/push
  appears in the private repo, then execute the quickstart recovery procedure end-to-end and confirm
  restored data. Not part of the automated suite.

**Rationale**: Puts every correctness-critical behaviour under the automated gates while honouring
FR-014 (never run the real backup locally). Recovery is validated by the human procedure FR-012
mandates.

**Alternatives considered**: Integration-testing the shell with a fake remote (rejected — high
effort, low value; the real risk is the Pi environment, which manual FR-012 covers).
