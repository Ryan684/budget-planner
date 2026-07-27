# Implementation Plan: Polish & Hardening (Phase 5)

**Branch**: `feature/005-polish-hardening` | **Date**: 2026-07-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-polish-hardening/spec.md`

## Summary

Phase 5 is the final MVP phase. It hardens the shipped app for daily family use, adding no new
budgeting features. Five slices:

1. **Optional PIN gate** (US1) — a lock screen shown on load when a PIN is configured, verified by
   a **new minimal backend endpoint** (`POST /api/verify-pin`) so the PIN value never ships in the
   client bundle. Unlock is per browser session. When no PIN is configured, the app loads straight
   through.
2. **Previous-month read-only, reconciled to the calendar month** (US2) — the UI already hides
   add/edit/delete for non-editable months (Phase 2), but it currently treats the **latest** month
   as editable. This phase **reconciles the whole app to a single calendar-month definition** of
   "current month" (UI editable month, Claude write target, dashboard default), and adds the
   missing **backend guard** rejecting income/bill writes to any month other than the current
   calendar month. Notes stay editable on any month; accounts are exempt (not month-scoped).
3. **Graceful error states** (US3) — friendly, retryable states when the backend is unreachable,
   when the Anthropic API is down (conversation preserved), and when a write fails (refetch true
   state). Most of the building blocks exist (`StateView`, `ApiError`); this completes coverage.
4. **Backup-status banner** (US3) — a **new backend endpoint** (`GET /api/backup-status`) parses
   the Phase 4 run log (`BACKUP_LOG_FILE`) for the last `SUCCESS`/`FAILED` + timestamp; the
   dashboard shows a warning banner on failure or staleness (`BACKUP_STALE_HOURS`, default 36h).
   Missing/unreadable log → `unknown`, no banner (dev-safe).
5. **README + fresh-Pi E2E** (US4) — complete the README setup guide (incl. Tailscale) and a
   documented, operator-run end-to-end checklist. Pi-only manual, like the Phase 4 gates.

The correctness-critical new logic (PIN verification, read-only guard, backup-log parsing) is
Python + unit/mutation tested; the frontend changes are Vitest-tested; the fresh-Pi run is manual.

## Technical Context

**Language/Version**: Python 3.14 (backend); TypeScript 5.x on React 18 + Vite (frontend). POSIX
shell / systemd already in place from Phase 4 (unchanged here).

**Primary Dependencies**: Existing stack only — FastAPI, Pydantic v2, SQLAlchemy ORM (backend);
React + Vite, CSS modules (frontend). New backend code uses **standard library only**
(`datetime`, `pathlib`, `re`/string parsing for the log). **No new Python or npm packages.**

**Storage**: SQLite (unchanged; no schema change — all three Phase 5 concepts are derived, not
stored). Backup status is read from the Phase 4 **run log file** (`BACKUP_LOG_FILE`), not the DB.

**Testing**: pytest (`verify-pin`, read-only guard on income/bills/months, backup-log parsing +
staleness + missing-log). Vitest + Testing Library (PIN gate, read-only reconciliation, error
states, backup banner). mutmut adds the new backend modules to `paths_to_mutate`; Stryker for the
new frontend logic. Fresh-Pi E2E (FR-018) is manual per quickstart.

**Target Platform**: Raspberry Pi 5 (production); localhost for dev. The PIN gate, read-only
reconciliation, error states, and backup banner all run in both; only the fresh-Pi E2E is Pi-only.

**Project Type**: Self-hosted web app (FastAPI backend + React frontend). Two new HTTP endpoints,
one backend guard on existing endpoints, several frontend changes, docs.

**Performance Goals**: Not latency-sensitive. `verify-pin` and `backup-status` are trivial reads;
the backup log is read tail-first (last line wins) so size is not a concern at family scale.

**Constraints**: PIN never sent to Claude, never in a backup export, never in the client bundle
(FR-005/FR-005a). No new dependencies. No DB schema change. Backend read-only guard must not break
carry-forward (reading a previous month to seed a new one is not a write to it, FR-010). Money and
timestamp display rules (Constitution III/V) unchanged.

**Scale/Scope**: One household. New code: ~2 small backend modules/functions + endpoints, one
backend guard helper, ~1 frontend PIN gate + context, `useMonths` change, backup banner, error-
state completion, README + quickstart. No data migration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Spec-First, Test-First** — PASS. Gherkin scenarios for US1–US4 are added to
  `docs/budget-planner.feature` first, then failing pytest/Vitest, then minimum code. The fresh-Pi
  E2E (FR-018) cannot be unit-tested and is verified by the documented Pi procedure (parallels the
  Phase 4 justification).
- **II. Quality Gates** — PASS. `ruff check .` + `ruff format --check .` + pytest (backend);
  `npm run lint` + `npx tsc --noEmit` + `npm run test` (frontend); mutmut for new backend modules,
  Stryker for new frontend logic; survivors recorded in `MUTANTS.md`.
- **III. Typed, Schema-Driven, ORM-Only** — PASS. New endpoints use Pydantic request/response
  schemas; the read-only guard and month queries go through the SQLAlchemy ORM; TypeScript with no
  `any`; CSS modules for the PIN gate and banner (no inline styles); money/negatives rules unchanged.
- **IV. Privacy & AI Data Boundary** — PASS **with a scoped amendment**. The PIN remains excluded
  from Claude context and backups (FR-005). **The definition of "active current month" that bounds
  Claude's writes changes from the _latest_ month to the _calendar_ month** (spec reconciliation
  2026-07-26). Claude still writes only to that single current month and previous months stay
  read-only, so the *principle* holds; the *wording* ("active current month") is reinterpreted as
  the calendar month and Principle IV + `CLAUDE.md` are updated together (Governance requires the
  two stay in sync). Recorded in Complexity Tracking and as a Phase 3 spec divergence.
- **V. Data Durability & Integrity** — PASS. No schema change; append-only `amendments` untouched;
  the backend read-only guard *strengthens* integrity (blocks edits to historical months). Budget
  figures still recomputed fresh after writes.

**Result: PASS.** One scoped constitution amendment (Principle IV "current month" wording) and one
justified TDD exception (fresh-Pi E2E), both in Complexity Tracking. No new dependencies, no schema
change.

## Project Structure

### Documentation (this feature)

```text
specs/005-polish-hardening/
├── plan.md              # This file
├── research.md          # Phase 0 output (decisions: PIN verify path, calendar-month resolution,
│                        #   backup-log parsing, error-state UX, timezone source)
├── data-model.md        # Phase 1 output (derived concepts + endpoint payloads — no DB tables)
├── quickstart.md        # Phase 1 output (fresh-Pi setup + E2E validation checklist)
├── contracts/
│   ├── verify-pin.md         # POST /api/verify-pin request/response/behaviour
│   ├── backup-status.md      # GET /api/backup-status payload + staleness + missing-log
│   └── read-only-guard.md    # Read-only rejection contract on income/bills/months endpoints
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── config.py                 # CHANGE — add backup_log_file, backup_stale_hours settings
├── current_month.py          # NEW — resolve the current-calendar-month BudgetMonth (single source)
├── backup_status.py          # NEW — parse BACKUP_LOG_FILE → (result, timestamp, stale?) or unknown
├── routers/
│   ├── auth.py               # NEW — POST /api/verify-pin (checks against settings.app_pin)
│   ├── system.py             # NEW — GET /api/backup-status
│   ├── deps.py               # CHANGE — add current_calendar_month_id; keep latest_month_id or retire
│   ├── income.py             # CHANGE — reject create/update/delete outside the current month
│   ├── bills.py              # CHANGE — same read-only guard as income
│   └── claude.py             # CHANGE — write target moves latest_month_id → current calendar month
├── claude_context.py         # CHANGE (if needed) — "current month" label reflects calendar month
└── tests/
    ├── test_auth.py          # NEW — verify-pin: correct / wrong / not-configured
    ├── test_backup_status.py # NEW — SUCCESS/FAILED parse, staleness, missing/malformed log
    └── test_read_only.py     # NEW — writes to non-current month rejected; current month allowed

frontend/
├── src/
│   ├── api/
│   │   ├── auth.ts           # NEW — verifyPin()
│   │   └── system.ts         # NEW — getBackupStatus()
│   ├── hooks/
│   │   ├── useMonths.ts      # CHANGE — editableMonthId = current calendar month (not latest)
│   │   └── usePinGate.ts     # NEW — session unlock state + verifyPin
│   ├── components/
│   │   ├── PinGate.tsx (+.module.css)     # NEW — lock screen
│   │   └── BackupBanner.tsx               # NEW — dashboard warning banner (reuses Banner)
│   ├── screens/Dashboard.tsx # CHANGE — render BackupBanner; uncreated-current-month prompt
│   └── App.tsx               # CHANGE — gate app behind PinGate when configured
└── (Vitest tests alongside each new/changed unit)

docs/
├── budget-planner.feature    # CHANGE — add US1–US4 Gherkin scenarios
└── progress-log.md           # CHANGE — Phase 5 session handoff

README.md                     # CHANGE — complete fresh-Pi guide (Tailscale, PIN, BACKUP_STALE_HOURS)
.specify/memory/constitution.md  # CHANGE — Principle IV "current month" wording (with CLAUDE.md)
CLAUDE.md                     # CHANGE — mirror the current-month wording + env vars
```

**Structure Decision**: Existing web-app layout (`backend/` + `frontend/`). Phase 5 adds two small
router modules and two backend helper modules, changes a handful of existing files to reconcile the
current-month definition and add the read-only guard, and adds a PIN gate + backup banner on the
frontend. No new top-level structure, no new dependencies, no DB schema change.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Constitution IV wording amendment (latest-month → calendar-month "current month") | The clarified spec (2026-07-26) requires the editable/writable month to track the real calendar month uniformly across UI, Claude, and dashboard | Leaving Claude on the latest month while the UI uses the calendar month creates two conflicting "current months" — inconsistent writes and user confusion. A single definition is the simpler end state; the cost is a one-time reconciliation of shipped Phase 2/3 code. |
| Fresh-Pi E2E (FR-018) not covered by automated tests | Bringing a physical Pi online from the README (USB SSD, systemd, Tailscale, backup timer) cannot be exercised in CI | Faking it in CI would assert nothing about real hardware/network; a documented operator checklist is the only meaningful verification (same rationale as Phase 4's Pi-only gates). |
