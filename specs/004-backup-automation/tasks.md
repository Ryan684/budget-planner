---
description: "Task list for Phase 4 — Backup Automation"
---

# Tasks: Backup Automation

**Input**: Design documents from `specs/004-backup-automation/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/backup-cli.md ✅, quickstart.md ✅

**Tests**: Included — TDD is mandatory per CLAUDE.md build order (write failing tests before implementation).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies between parallel tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Gherkin-first update and mutmut config — must complete before any code.

- [X] T001 Revise the stale `Feature: Backup` block in `docs/budget-planner.feature` — replace with clarified scenarios for US1 (nightly offsite backup including integrity-verify, stable filename, no-change guard), US2 (recovery from backup repo; JSON-only fallback), and US3 (log records success/failure with timestamp), sourced from `specs/004-backup-automation/spec.md` acceptance scenarios
- [X] T002 Add `backend/backup.py` to `paths_to_mutate` in the `[tool.mutmut]` section of `pyproject.toml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared test infrastructure that all US1 tests depend on.

**⚠️ CRITICAL**: US1 tests cannot be written without this fixture in place.

> **Note**: No new database tables or ORM models are needed — this feature has no new schema. The existing `claude_context.build_budget_context`, `database.SessionLocal`, and `config.settings` are already in place from Phase 1. The only foundational task is the shared pytest fixture.

- [X] T003 Create or update `backend/tests/conftest.py` — add a `seeded_db` pytest fixture that creates a temporary in-memory (or `tmp_path`) SQLite database, applies the app schema via `SQLAlchemy Base.metadata.create_all`, inserts one month with one income entry, one bill, and one account with a balance snapshot, and yields a `SessionLocal`-compatible session; this fixture is used by all backup tests in `backend/tests/test_backup.py`

**Checkpoint**: `seeded_db` fixture importable — US1 test writing can now begin.

---

## Phase 3: User Story 1 — Unattended Nightly Offsite Backup (Priority: P1) 🎯 MVP

**Goal**: A nightly systemd timer (with catch-up) invokes `scripts/backup.sh`, which calls `backend/backup.py` to produce a consistent, verified DB copy and full-history JSON export, then commits and pushes both artifacts to the private backup repo.

**Independent Test**: Run `sudo systemctl start budget-backup.service` on the Pi; confirm a new commit appears in the private backup GitHub repo containing `budget.db` and `budget-export.json`; confirm `$BACKUP_LOG_FILE` records a `[<ts>] SUCCESS` line — with no manual steps beyond the trigger.

### Tests for User Story 1 (TDD — write these FIRST, confirm they FAIL before implementing `backup.py`) ⚠️

> **NOTE: These tests must exist and fail before T010 is started. Run `pytest backend/tests/test_backup.py` after each test is written to confirm failure.**

- [X] T004 [US1] Write failing test `test_consistent_copy_roundtrip` in `backend/tests/test_backup.py` — using `seeded_db` fixture, call the backup module's copy function with a `tmp_path` destination, assert the copy opens as a valid SQLite DB and contains the seeded month's income record
- [X] T005 [US1] Write failing test `test_integrity_check_detects_corruption` in `backend/tests/test_backup.py` — produce a DB copy, truncate it to simulate corruption, call the integrity-check function, assert it raises `BackupError` (or equivalent) and does NOT exit 0
- [X] T006 [US1] Write failing test `test_export_envelope_shape` in `backend/tests/test_backup.py` — call the JSON export function with `seeded_db`, assert the serialised output has top-level keys `exported_at`, `schema_version`, `data`; assert `schema_version == 1`; assert `exported_at` is a valid UTC ISO-8601 string; assert `data` contains `months`, `accounts`, `balance_snapshots`, `amendments`
- [X] T007 [US1] Write failing test `test_json_verify_rejects_malformed_json` in `backend/tests/test_backup.py` — patch `json.dumps` (or the file write) to produce invalid JSON, call the export function, assert `BackupError` is raised before the file is written or confirmed
- [X] T008 [US1] Write failing test `test_empty_db_backup_succeeds` in `backend/tests/test_backup.py` — create a fresh empty DB (schema only, no rows), run the full backup routine to `tmp_path`, assert both output files are written, the DB copy passes integrity check, and the JSON parses without error
- [X] T009 [US1] Write failing test `test_no_secrets_in_export` in `backend/tests/test_backup.py` — run the export on `seeded_db`, serialise the result to a string, assert that none of the strings `ANTHROPIC_API_KEY`, `APP_PIN`, `sk-ant`, `.env` appear anywhere in the serialised JSON
- [X] T009a [US1] Write failing test `test_missing_source_db_fails` in `backend/tests/test_backup.py` — point the source DB path at (a) a missing file and (b) a zero-length file, run the backup routine to `tmp_path`, assert it raises `BackupError` (and the CLI exits non-zero) and leaves no "verified" artifact — covering the spec edge case "database file missing or zero-length at backup time" (spec.md Edge Cases / FR-009) and the source-missing/empty exit code in `specs/004-backup-automation/contracts/backup-cli.md` §A

### Implementation for User Story 1

- [X] T010 [US1] Implement `backend/backup.py` — define a `BackupError` exception; structure the correctness logic as functions that **raise `BackupError`** on any failure (so they are unit-testable per T005/T007/T009a — these functions never call `sys.exit`), plus a thin `argparse` CLI `main()` that catches `BackupError`, writes a short reason to **stderr**, and calls `sys.exit(1)` (the CLI entrypoint is the only place that exits). CLI takes required `--db-out` and `--json-out` args; SQLite online-backup copy via `sqlite3.connect(src_path).backup(sqlite3.connect(db_out))`; `PRAGMA integrity_check` on the copy (raise `BackupError` if result ≠ single `'ok'`); JSON export envelope `{"exported_at": <UTC ISO-8601>, "schema_version": 1, "data": build_budget_context(session)}`; `json.loads` round-trip verify on the serialised string (raise `BackupError` if it does not re-parse) before writing `--json-out`; exit 0 on full success — match the contract in `specs/004-backup-automation/contracts/backup-cli.md` §A exactly; add inline comment justifying direct `sqlite3` use (ORM maintenance exception per constitution §III)
- [X] T011 [US1] Run `pytest backend/tests/test_backup.py` and confirm all seven tests (T004–T009, T009a) pass against the `backend/backup.py` implementation from T010; fix any implementation gaps until all pass
- [X] T012 [P] [US1] Write `scripts/backup.sh` — POSIX shell; `set -euo pipefail`; load `.env.production` (if present); acquire non-blocking `flock` on `$BACKUP_LOCK_FILE` (exit non-zero if held — concurrent run guard); `cd backend && python backup.py --db-out "$BACKUP_REPO_DIR/budget.db" --json-out "$BACKUP_REPO_DIR/budget-export.json"` (abort on non-zero exit); `cd "$BACKUP_REPO_DIR" && git add budget.db budget-export.json` (explicit filenames only — never `git add -A`); `git diff --cached --quiet` → if true, append `[<UTC ts>] SUCCESS` to `$BACKUP_LOG_FILE` and exit 0 without committing; else `git commit -m "Backup $(date -u +%Y-%m-%dT%H:%M:%SZ)"` then `git push`; append outcome line to `$BACKUP_LOG_FILE` (SUCCESS or `FAILED: <stage>`); exit non-zero on any failure — match contract in `specs/004-backup-automation/contracts/backup-cli.md` §B
- [X] T013 [P] [US1] Write `scripts/systemd/budget-backup.service` — `Type=oneshot`; `EnvironmentFile=` pointing to the production `.env.production` path; `ExecStart=` invoking `scripts/backup.sh` using its absolute path; runs as the app user — per `specs/004-backup-automation/contracts/backup-cli.md` §C
- [X] T014 [P] [US1] Write `scripts/systemd/budget-backup.timer` — `[Timer]` section: `OnCalendar=*-*-* 02:30:00`, `Persistent=true` (triggers catch-up run on next boot if Pi was off at scheduled time — FR-001); `[Install]` section: `WantedBy=timers.target` — per `specs/004-backup-automation/contracts/backup-cli.md` §C

**Checkpoint**: At this point, `backend/backup.py` passes all seven tests, `scripts/backup.sh` is ready to invoke, and the systemd units are ready to install. US1 is independently testable on the Pi.

---

## Phase 4: User Story 2 — Reliable Recovery from Backup (Priority: P1)

**Goal**: A documented, end-to-end-tested procedure that lets an operator restore the app from the backup repo alone. JSON export stands alone as a human-readable fallback if the binary DB is corrupt.

**Independent Test**: Follow the recovery steps in `README.md` on a clean machine using only the backup repo contents; confirm the app starts and all months, income, bills, accounts, and balances are intact.

- [X] T015 [US2] Add a `## Backup & Recovery` section to `README.md` containing: (a) one-time Pi setup — clone the private backup repo onto the Pi at `$BACKUP_REPO_DIR`, install `scripts/backup-repo.gitignore` as `$BACKUP_REPO_DIR/.gitignore`; set `BACKUP_REPO_DIR`, `BACKUP_LOG_FILE`, `BACKUP_LOCK_FILE` in `.env.production`; (b) install systemd units — `sudo cp` both unit files to `/etc/systemd/system/`, `daemon-reload`, `enable --now budget-backup.timer`, `list-timers`; (c) verify a run — `sudo systemctl start budget-backup.service`, inspect `$BACKUP_LOG_FILE`, confirm GitHub commit; (d) full recovery procedure — stop app services, `cp budget.db` from backup repo to `DATABASE_URL` path, restart services, verify data in the app; (e) JSON-only fallback — open `budget-export.json` from the backup repo to manually read financial history when the binary DB is unreadable — following `specs/004-backup-automation/quickstart.md` §2–§4 exactly (FR-011, FR-013)
- [X] T016 [P] [US2] Write `scripts/backup-repo.gitignore` — a `.gitignore` that ignores everything (`*`) except `!budget.db`, `!budget-export.json`, `!README.md`, `!.gitignore`; operators copy this file into the cloned private backup repo during Pi setup to prevent accidental secret commits (FR-007, research.md §4)

**Checkpoint**: README.md recovery procedure is complete and citable. US2 is independently verifiable by an operator following the written steps.

---

## Phase 5: User Story 3 — Visibility into Backup Health (Priority: P2)

**Goal**: Every run appends a durable, timestamped outcome line to a local log file, regardless of whether the push succeeded — so a silently broken backup cannot go unnoticed.

**Independent Test**: Run the routine once successfully and once under forced failure (e.g. unreachable remote); confirm `$BACKUP_LOG_FILE` records a distinct, timestamped `SUCCESS` and `FAILED: <reason>` line for each.

- [X] T017 [US3] Audit `scripts/backup.sh` from T012 — verify that every exit path (lock conflict, `backup.py` failure, no-change clean exit, `git commit`/`push` failure, full success) appends exactly one `[<UTC ISO-8601 ts>] SUCCESS` or `[<ts>] FAILED: <stage/reason>` line to `$BACKUP_LOG_FILE` before exiting, matching the format in `specs/004-backup-automation/data-model.md` §3; add any missing log-write statements; confirm the log file is written locally even when `git push` fails (FR-008)

**Checkpoint**: All three user stories (US1 nightly backup, US2 recovery docs, US3 health log) are implemented and independently verifiable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Linting, mutation testing, and session handoff.

- [X] T018 [P] Run `cd backend && ruff check . && ruff format --check .` across all changed files (`backup.py`, `tests/test_backup.py`, `tests/conftest.py`); fix all errors and warnings; do not suppress without an inline justification comment
- [X] T019 [P] Run `pytest backend/` and confirm the full backend test suite passes (not just backup tests); fix any regressions introduced by the new `conftest.py` fixtures
- [X] T020 Run `mutmut run --paths-to-mutate backend/backup.py` after T019 passes; for each surviving mutant, add an entry to `MUTANTS.md` with the mutant ID, what was mutated, and why it is acceptable (per CLAUDE.md build order step 7)
- [X] T021 [P] Update `docs/progress-log.md` — mark Phase 4 status ✅ complete; list all files created/modified (`backend/backup.py`, `backend/tests/test_backup.py`, `backend/tests/conftest.py`, `scripts/backup.sh`, `scripts/backup-repo.gitignore`, `scripts/systemd/budget-backup.service`, `scripts/systemd/budget-backup.timer`, `docs/budget-planner.feature`, `README.md`); record spec divergence (systemd timer with `Persistent=true` instead of cron, per research.md §5 and plan.md Complexity Tracking); note that Pi-level end-to-end and recovery tests (quickstart.md §3–§4, FR-012) must be executed manually by the operator and their completion recorded here; write the exact first thing the next session (Phase 5) should do

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all US1 test writing
- **US1 (Phase 3)**: Depends on Phase 2; tests T004–T009 and T009a must be written and failing before T010
- **US2 (Phase 4)**: Depends on US1 completion (T010–T014 done) so filenames/paths are known
- **US3 (Phase 5)**: Depends on T012 (`backup.sh` written) — audits and extends it
- **Polish (Phase 6)**: Depends on all user story phases being complete

### User Story Dependencies

- **US1 (P1)**: Sole dependency is the Phase 2 fixture (T003). No dependency on US2 or US3.
- **US2 (P1)**: Depends on US1 (needs artifact paths, systemd unit names, and `scripts/backup-repo.gitignore` from T016 created alongside)
- **US3 (P2)**: Depends on US1 `backup.sh` (T012) existing — audits it

### Within User Story 1

- T004–T009 and T009a are sequential (all write to the same `backend/tests/test_backup.py`)
- T010 depends on T004–T009 and T009a being written (TDD gate)
- T011 depends on T010 (verifies the implementation passes the tests)
- T012, T013, T014 can run in parallel with each other after T010 (different files; all follow contracts already defined)

### Parallel Opportunities

- T012, T013, T014 are parallel with each other (different files, no mutual dependencies)
- T015, T016 are parallel with each other (different files)
- T018, T019, T021 are parallel with each other (linting, test run, docs)
- T020 depends on T019 (mutmut requires tests to pass first)

---

## Parallel Example: User Story 1 (after `backup.py` implementation T010)

```bash
# Once T010 (backup.py) is implemented, launch in parallel:
Task T012: Write scripts/backup.sh
Task T013: Write scripts/systemd/budget-backup.service
Task T014: Write scripts/systemd/budget-backup.timer
```

## Parallel Example: Polish Phase

```bash
# Launch concurrently:
Task T018: ruff check/format backend/
Task T019: pytest backend/  (full suite)
Task T021: Update docs/progress-log.md

# Only after T019 passes:
Task T020: mutmut run --paths-to-mutate backend/backup.py
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003) — CRITICAL, blocks all tests
3. Complete Phase 3: User Story 1 (T004–T014)
4. **STOP and VALIDATE**: Run `pytest backend/tests/test_backup.py` (all pass) then trigger a real run on the Pi
5. Proceed to US2/US3 once US1 is confirmed working on the Pi

### Incremental Delivery

1. Setup + Foundational → test infrastructure ready
2. US1 tests written (failing) → implementation gate set
3. US1 implemented → `backup.py` + `backup.sh` + systemd units ready → trigger on Pi to validate
4. US2 documentation written → recovery procedure is citable and testable by operator
5. US3 audit → every log-write path confirmed
6. Polish → lint clean, mutation tested, progress log updated

---

## Notes

- Shell script (`scripts/backup.sh`) and systemd units are **Pi-only** — never run or test locally (FR-014); their end-to-end behaviour is verified by the operator on the Pi per `quickstart.md` §3–§4
- All six `test_backup.py` tests must be written **before** `backup.py` is implemented (CLAUDE.md build order step 2)
- `git add` in `backup.sh` must always name files explicitly (`git add budget.db budget-export.json`) — never `git add -A` or `git add .` (FR-007 secret-leak guard)
- `Persistent=true` on the timer is the implementation of FR-001 catch-up; do not remove it
- The `PRAGMA integrity_check` call and the SQLite online-backup API are direct `sqlite3` calls with an inline justification comment — the ORM exception is pre-approved in the constitution (plan.md Constitution Check §III)
