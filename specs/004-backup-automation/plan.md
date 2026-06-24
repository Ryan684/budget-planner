# Implementation Plan: Backup Automation

**Branch**: `feature/004-backup-automation` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-backup-automation/spec.md`

## Summary

Phase 4 adds an unattended nightly offsite backup of the SQLite database to a private GitHub
repository, plus a tested recovery procedure. The work splits cleanly into two layers:

1. **A testable Python backup module** (`backend/backup.py`) that produces a *consistent* copy of
   the live database (SQLite online-backup API), generates a full-history JSON export (reusing the
   existing `claude_context.build_budget_context` payload), and **verifies both artifacts**
   (SQLite `integrity_check` on the copy; JSON re-parses) before they are considered good. All the
   correctness-critical logic lives here and is unit-tested and mutation-tested.
2. **A thin shell orchestrator** (`scripts/backup.sh`) run by a **systemd timer with catch-up**
   (`Persistent=true`) that guards against concurrent runs (`flock`), invokes the Python module to
   write the two artifacts into the cloned backup repo, then `git add` (explicit files only) →
   `commit` (skipped cleanly when nothing changed) → `push`, and appends a timestamped
   success/failure line to a **local log file on the Pi**. Git/systemd/network orchestration is
   verified on the Pi (manual, per FR-012/FR-014), not in the automated suite.

## Technical Context

**Language/Version**: Python 3.14 (backend module + tests); POSIX shell (orchestrator); systemd
unit files (scheduling).

**Primary Dependencies**: Standard library only for the new Python code — `sqlite3` (online backup
+ `PRAGMA integrity_check`), `json`, `pathlib`, `argparse`. Reuses existing `claude_context`,
`database`, `config`, `budget`, `models` modules and SQLAlchemy ORM. OS tooling on the Pi: `git`,
`flock` (util-linux), `systemd`. **No new Python or npm packages.**

**Storage**: SQLite (source: `settings.database_url`; on the Pi `/mnt/usbssd/budget.db`).
Artifacts written into a separately-cloned private backup git repo working tree.

**Testing**: pytest for `backend/backup.py` (consistent copy, integrity detection, export shape,
JSON-verify, empty-DB). Shell script + systemd timer + git push + recovery: manual on the Pi per
quickstart (FR-012, FR-014). mutmut adds `backup.py` to `paths_to_mutate`.

**Target Platform**: Raspberry Pi 5 (production, where the backup runs). Python module is unit-
tested on the dev machine; the shell/systemd/git path is Pi-only.

**Project Type**: Self-hosted web app (FastAPI backend + React frontend). This feature is a
backend/ops add-on — no frontend and no new HTTP endpoint.

**Performance Goals**: Not latency-sensitive. A nightly run on a small family-budget DB completes
in seconds. The online-backup copy must not block or corrupt the live app (read-consistent).

**Constraints**: Must never commit secrets/`.env`/PIN/API key (FR-007). Must never overwrite good
history with a corrupt or empty artifact (FR-004a, FR-009). Catch up a missed run on next boot
(FR-001). Pi-only; never runs in local dev or CI (FR-014).

**Scale/Scope**: One household, one small SQLite DB, one nightly run. New code: one Python module
(~120 lines) + tests, one shell script, two systemd unit files, README + feature-file updates.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Spec-First, Test-First** — PASS (with justified scope). Gherkin scenarios in
  `docs/budget-planner.feature` are revised first (the existing stale `Feature: Backup` block
  predates the 2026-06-24 clarifications), then failing pytest for `backend/backup.py`, then code.
  The shell/systemd/git layer cannot be meaningfully unit-tested and is forbidden from running
  locally (FR-014); it is verified by the documented Pi procedure (FR-012). See Complexity Tracking.
- **II. Quality Gates** — PASS. `ruff check .` + `ruff format --check .` and pytest for the Python
  module; mutmut run with `backup.py` added to scope, survivors recorded in `MUTANTS.md`. No
  frontend change, so no eslint/tsc. (No shell linter is configured in the constitution; the script
  is kept minimal and reviewed manually.)
- **III. Typed, Schema-Driven, ORM-Only** — PASS (with one justified exception). The JSON export
  reads through the SQLAlchemy ORM (`build_budget_context`). `PRAGMA integrity_check` and the
  SQLite online-backup API are database *maintenance* operations with no ORM expression; they are
  used directly with an inline justification comment (genuinely inapplicable rule, per the
  constitution's "unless genuinely inapplicable" clause). Full type hints on the new module.
- **IV. Privacy & AI Data Boundary** — PASS / reinforced. The JSON export reuses the same
  privacy-bounded payload that already governs what may leave the app (`build_budget_context`):
  structured financial data only — never `.env`, secrets, or the PIN. The DB copy contains only
  budget data (PIN and API key live in the environment, not the DB). Artifacts are added to git by
  explicit filename, never `git add -A`, so stray files can't leak.
- **V. Data Durability & Integrity** — PASS / central to this feature. The live DB is read with a
  consistent online-backup snapshot (no torn read); the append-only `amendments` table is untouched;
  a corrupt/empty artifact is rejected rather than stored over good history.

**Result: PASS.** One justified deviation (TDD scope for shell/systemd) and one justified rule
exception (direct SQLite maintenance calls) recorded in Complexity Tracking. No new dependencies.

## Project Structure

### Documentation (this feature)

```text
specs/004-backup-automation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (artifact shapes — no new DB tables)
├── quickstart.md        # Phase 1 output (Pi setup + recovery test procedure)
├── contracts/
│   └── backup-cli.md    # CLI/exit-code/env contract for backup.py and backup.sh
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── backup.py                 # NEW — consistent DB copy + integrity verify + JSON export + verify
├── claude_context.py         # REUSED — build_budget_context() supplies the export payload
├── config.py                 # unchanged (source DB path via settings.database_url)
├── database.py               # REUSED — engine / SessionLocal
└── tests/
    └── test_backup.py        # NEW — unit tests for backup.py

scripts/
├── backup.sh                 # NEW — flock + invoke backup.py + git add/commit/push + local log
└── systemd/
    ├── budget-backup.service # NEW — oneshot unit running backup.sh
    └── budget-backup.timer   # NEW — nightly OnCalendar + Persistent=true (catch-up)

docs/
└── budget-planner.feature    # REVISED — replace stale Backup scenarios with clarified ones

README.md                     # NEW — Backup & Recovery setup + tested recovery procedure
                              #       (Phase 5 expands into the full setup guide)
```

**Structure Decision**: Reuse the existing `backend/` Python project for the testable logic (so it
sits inside the established pytest/ruff/mutmut gates and can `import claude_context`), and add a new
top-level `scripts/` directory (matching the `scripts/backup.sh` path already named in `CLAUDE.md`)
for the shell orchestrator and systemd units. No new HTTP endpoint and no frontend changes.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| TDD not applied to `backup.sh`/systemd units (no failing test first; verified manually on Pi) | Git push, `flock`, network, and systemd timers cannot be exercised meaningfully by pytest, and FR-014 forbids running the backup against a dev machine | Mocking git/network/systemd would test the mocks, not the behaviour; the real risk lives in the Pi environment, which FR-012 covers with a documented, executed recovery test. All correctness-critical logic is pushed into the unit-tested `backup.py` to keep the shell layer thin |
| Direct SQLite calls (`PRAGMA integrity_check`, online-backup API) instead of SQLAlchemy ORM | A consistent online copy and an integrity check are DB-maintenance operations with no ORM equivalent | Copying the file with `shutil` risks a torn read during a live write; reconstructing integrity checking in the ORM is not possible. Justified inline per the constitution's "genuinely inapplicable" clause |
| Scheduling via systemd timer rather than the literal "cron job" in spec/`CLAUDE.md` | The 2026-06-24 clarification requires catch-up of a missed run on next boot; plain cron cannot do this | `anacron` also works but the Pi already runs the app under systemd; a `Persistent=true` timer gives native catch-up with no extra package. Logged as a spec divergence to reconcile in `CLAUDE.md`/spec on merge |
