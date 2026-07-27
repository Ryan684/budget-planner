---
description: "Task list for Phase 5 — Polish & Hardening"
---

# Tasks: Polish & Hardening

**Input**: Design documents from `specs/005-polish-hardening/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ (verify-pin, backup-status, read-only-guard) ✅, quickstart.md ✅

**Tests**: Included — TDD is mandatory per Constitution Principle I and the CLAUDE.md build order (write failing tests before implementation).

**Organization**: Tasks are grouped by user story (US1–US4 from spec.md) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies between parallel tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: Gherkin-first acceptance scenarios and mutation-test config — must complete before any code (Constitution build order step 1).

- [X] T001 Add clarified Gherkin scenarios for US1–US4 to `docs/budget-planner.feature` (a `Feature: Polish & Hardening` block): PIN gate shown/skipped/wrong/unlock/session (US1); previous+future months read-only for income/bills, notes editable, accounts editable, current = calendar month (US2); backend-unreachable / Claude-API-down / failed-write error states and the backup banner failed/stale/healthy/unknown (US3); README-driven fresh-Pi bring-up (US4) — sourced from `specs/005-polish-hardening/spec.md` acceptance scenarios
- [X] T002 [P] Add `backend/current_month.py`, `backend/backup_status.py`, `backend/routers/auth.py`, and `backend/routers/system.py` to `paths_to_mutate` in the `[tool.mutmut]` section of `backend/pyproject.toml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared config touched once so multiple stories don't collide. The four stories are otherwise largely independent, so this phase is deliberately small.

**⚠️ CRITICAL**: US3 (backup status) cannot be tested without these settings present.

- [X] T003 Add `backup_log_file: str = ""` and `backup_stale_hours: int = 36` settings to `backend/config.py` `Settings` (blank log file ⇒ status `unknown`, dev-safe), with docstring comments matching `data-model.md`

**Checkpoint**: Config settings importable — story work can begin. Stories may proceed in parallel; recommended order is P1 → P2 → P3 → P4.

---

## Phase 3: User Story 1 — Optional PIN protects the app (Priority: P1) 🎯 MVP

**Goal**: When a PIN is configured, a lock screen (verified by a backend endpoint so the PIN never ships in the bundle) gates the app until the correct PIN is entered; unlock persists for the browser session. When no PIN is configured, the app loads straight through.

**Independent Test**: Set `APP_PIN`, reload — gate shown, wrong PIN rejected, correct PIN unlocks and survives reload but re-locks in a new session; blank `APP_PIN` loads straight to the dashboard; the built bundle contains no PIN value.

### Tests for User Story 1 (TDD — write FIRST, confirm they FAIL) ⚠️

- [X] T004 [P] [US1] Failing pytest in `backend/tests/test_auth.py`: `POST /api/verify-pin` returns `{ok:true}` for the correct PIN, `{ok:false}` for a wrong PIN, `400` when `app_pin` is blank, `422` for a malformed body (per `contracts/verify-pin.md`)
- [X] T005 [P] [US1] Failing pytest in `backend/tests/test_auth.py`: `GET /api/pin-required` returns `{required:true}` when `app_pin` is set and `{required:false}` when blank
- [X] T006 [P] [US1] Failing Vitest in `frontend/src/components/__tests__/PinGate.test.tsx`: gate renders when required, a wrong PIN shows an error and stays locked, a correct PIN unlocks; unlock persists via `sessionStorage` and a network/5xx error shows a retryable state without revealing data

### Implementation for User Story 1

- [X] T007 [US1] Add Pydantic `PinVerifyRequest`/`PinVerifyResponse`/`PinRequiredResponse` schemas to `backend/schemas.py`
- [X] T008 [US1] Implement `backend/routers/auth.py` — `POST /api/verify-pin` (constant-time compare via `hmac.compare_digest` against `settings.app_pin`; `400` when blank) and `GET /api/pin-required`; register the router in `backend/main.py`
- [X] T009 [P] [US1] Implement `frontend/src/api/auth.ts` — `verifyPin(pin)` and `pinRequired()` client functions using `apiFetch`
- [X] T010 [US1] Implement `frontend/src/hooks/usePinGate.ts` — session unlock state (`sessionStorage`), `pinRequired` check on load, and `verify(pin)` flow (depends on T009)
- [X] T011 [US1] Implement `frontend/src/components/PinGate.tsx` + `PinGate.module.css` — mobile-first lock screen (CSS module, no inline styles) (depends on T010)
- [X] T012 [US1] Gate the app in `frontend/src/App.tsx` — render `PinGate` when `pin-required` and not unlocked; render the app otherwise; skip entirely when not required (depends on T011)

**Checkpoint**: US1 is fully functional and independently testable.

---

## Phase 4: User Story 2 — Previous months read-only, reconciled to the calendar month (Priority: P2)

**Goal**: Income and bills are editable only in the current **calendar** month; earlier and future-dated months are read-only (notes stay editable, accounts exempt). A single calendar-month definition of "current month" is applied uniformly across the UI editable month, the Claude write target, and the dashboard, superseding the shipped latest-month behaviour.

**Independent Test**: With a current-calendar month plus an older month present, the older month shows no income/bills edit controls and a `403` on a direct API write, while the current month edits; a future month is read-only; Claude writes land in the calendar month; notes and accounts remain editable everywhere.

### Tests for User Story 2 (TDD — write FIRST, confirm they FAIL) ⚠️

- [X] T013 [P] [US2] Failing pytest in `backend/tests/test_current_month.py`: the current-month helper resolves the `BudgetMonth` whose `month` equals the injected local `YYYY-MM`, and returns `None` when no such month exists (inject/patch the reference date so the test is deterministic)
- [X] T014 [P] [US2] Failing pytest in `backend/tests/test_read_only.py`: create/update/delete income and bills on a non-current month return `403`; the same operations on the current calendar month succeed; a notes-only `PATCH /api/months/{id}` on an old month succeeds; an account balance update succeeds while a read-only month is the active view (FR-009); carry-forward creating a new month is NOT blocked (per `contracts/read-only-guard.md`)
- [X] T015 [P] [US2] Failing pytest in `backend/tests/test_read_only.py`: a Claude write targets the current calendar month; when the calendar month does not exist, the dispatch reports it has no month to write to
- [X] T016 [P] [US2] Failing Vitest in `frontend/src/hooks/__tests__/useMonths.test.ts`: `editableMonthId` is the month matching the browser's local `YYYY-MM` (not the latest month), and `isReadOnly` is true for both earlier and future-dated months
- [X] T017 [P] [US2] Failing Vitest in `frontend/src/screens/__tests__/Dashboard.test.tsx`: when no month matches the current calendar month, the dashboard shows a "create this month" prompt rather than treating the latest month as editable

### Implementation for User Story 2

- [X] T018 [US2] Implement `backend/current_month.py` — resolve the current-calendar-month `BudgetMonth`/id from local time; add `current_calendar_month_id(session)` to `backend/routers/deps.py` (retire `latest_month_id` from the write path)
- [X] T019 [US2] Add the read-only guard to `backend/routers/income.py` — reject create/update/delete with `403` "This month is read-only …" when the target's `month_id` ≠ current calendar month (depends on T018)
- [X] T020 [P] [US2] Add the same read-only guard to `backend/routers/bills.py` (depends on T018)
- [X] T021 [US2] Change the Claude write target in `backend/routers/claude.py` and `backend/claude_tools.py` from `latest_month_id` to the current calendar month; ensure the context "current month" label matches (`backend/claude_context.py` if needed) (depends on T018)
- [X] T022 [US2] Update `frontend/src/hooks/useMonths.ts` — compute `editableMonthId` as the month matching the browser-local `YYYY-MM`; `isReadOnly(monthId)` accordingly
- [X] T023 [US2] Update `frontend/src/screens/Dashboard.tsx` (and `App.tsx` active-month wiring if needed) — show a create-current-month prompt when the calendar month is absent; keep read-only messaging consistent (depends on T022)
- [X] T024 [US2] Record the Phase 3 "current month = calendar month" divergence in `docs/progress-log.md`. (The governing wording is **already amended** ahead of implementation — Constitution Principle IV → v1.2.0 and the `CLAUDE.md` mirror, both 2026-07-26; verify the code in T018–T023 matches that wording and no stray "latest month" write path remains.)

**Checkpoint**: US1 and US2 both work independently; the whole app shares one calendar-month definition.

---

## Phase 5: User Story 3 — Graceful error states & backup banner (Priority: P3)

**Goal**: Every data screen shows a clear, retryable error when the backend is unreachable; the Claude screen preserves the conversation and typed message when the API is down; failed writes surface an error and refetch true state; and the dashboard warns when the last nightly backup failed or is stale (reading the Phase 4 log), with no false alarm when no log exists.

**Independent Test**: Stop the backend → retryable error within ~10s; simulate a Claude 502 → friendly error, conversation preserved; force a failed write → error + true state; point `BACKUP_LOG_FILE` at failed/stale/fresh logs → banner shows/shows/hidden; blank log → no banner.

### Tests for User Story 3 (TDD — write FIRST, confirm they FAIL) ⚠️

- [ ] T025 [P] [US3] Failing pytest in `backend/tests/test_backup_status.py`: `GET /api/backup-status` parses the last `SUCCESS`/`FAILED` line + UTC timestamp; computes `stale` against `BACKUP_STALE_HOURS`; returns `status:"unknown"`, `stale:false` for a blank/missing/malformed log (per `contracts/backup-status.md`)
- [ ] T026 [P] [US3] Failing Vitest in `frontend/src/components/__tests__/BackupBanner.test.tsx`: banner shows when `status:"failed"` or (`success` & `stale`), and is hidden when (`success` & not `stale`) or `unknown`
- [ ] T027 [P] [US3] Failing Vitest for error states: a backend-unreachable fetch yields a retryable `StateView` error within the timeout; a Claude 502 preserves conversation + input (`frontend/src/screens/__tests__/Claude.test.tsx`); a failed write surfaces an error and refetches (`frontend/src/screens/__tests__/Income.test.tsx` or `Bills.test.tsx`)

### Implementation for User Story 3

- [ ] T028 [P] [US3] Add the Pydantic `BackupStatusResponse` schema to `backend/schemas.py`
- [ ] T029 [US3] Implement `backend/backup_status.py` — read `settings.backup_log_file`, scan for the last complete `SUCCESS`/`FAILED` line, extract UTC timestamp, compute `stale` vs `settings.backup_stale_hours`; missing/unreadable/unparseable ⇒ `unknown`
- [ ] T030 [US3] Implement `backend/routers/system.py` — `GET /api/backup-status`; register the router in `backend/main.py` (depends on T029)
- [ ] T031 [P] [US3] Implement `frontend/src/api/system.ts` — `getBackupStatus()`
- [ ] T032 [US3] Implement `frontend/src/components/BackupBanner.tsx` (reuse the existing `Banner`) and render it on `frontend/src/screens/Dashboard.tsx` per the banner logic (depends on T031)
- [ ] T033 [US3] Add a client-side timeout (`AbortController`, ~10s) to `frontend/src/api/client.ts` so an unreachable backend surfaces a retryable error instead of hanging (SC-004)
- [ ] T034 [US3] Preserve the conversation and typed message on a Claude API failure (502) in `frontend/src/screens/Claude.tsx` / `frontend/src/hooks/useClaudeSession.ts`, with a friendly retryable error
- [ ] T035 [US3] On a failed income/bills/accounts write, surface the error and refetch true state (no stale/optimistic value) in the affected screens/hooks — including the month-boundary case where the UI treated a month as editable but the backend returned `403` (browser-local vs Pi-local current month; the backend is authoritative)

**Checkpoint**: US1–US3 all independently functional; the app degrades gracefully.

---

## Phase 6: User Story 4 — Fresh-Pi setup from the README (Priority: P4)

**Goal**: A complete README lets an operator bring a bare Pi to a working, backed-up, remotely accessible deployment; a documented end-to-end checklist verifies it.

**Independent Test**: Follow the README on a fresh Pi and complete the checklist with no undocumented steps (operator-run, Pi-only).

### Implementation for User Story 4

- [ ] T036 [US4] Complete the `README.md` fresh-Pi setup guide: USB SSD mount, Python/Node/SQLite prerequisites, `budget-backend`/`budget-frontend` systemd services, `.env.production` (incl. `APP_PIN`, `BACKUP_STALE_HOURS`, `BACKUP_LOG_FILE`/`BACKUP_REPO_DIR`/`BACKUP_LOCK_FILE`), backup systemd timer + SSH key, and Tailscale remote-access setup (FR-017)
- [ ] T037 [US4] Add the fresh-Pi end-to-end validation checklist to `README.md` (referencing `specs/005-polish-hardening/quickstart.md` Part B) so the operator can confirm every screen, PIN, read-only, Claude, backup run + alert, remote access, and recovery (FR-018)

**Checkpoint**: Documentation complete; the fresh-Pi E2E is executable by the operator.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and validation across all stories (Constitution II + build order).

- [ ] T038 [P] Run backend mutation tests (`cd backend && mutmut run`) for the new modules (`auth`, `current_month`, `backup_status`, income/bills guard); record any accepted survivors in `MUTANTS.md`
- [ ] T039 [P] Run frontend mutation tests (`cd frontend && npm run test:mutation`) for the new PIN/backup-banner/useMonths logic; record any accepted survivors in `MUTANTS.md`
- [ ] T040 Run all linters and test suites and fix everything: `cd backend && ruff check . && ruff format --check . && pytest`; `cd frontend && npm run lint && npx tsc --noEmit && npm run test`
- [ ] T041 Execute `specs/005-polish-hardening/quickstart.md` Part A (local validation of PIN, read-only, error states, backup banner) on the dev machine
- [ ] T042 Update `docs/progress-log.md` — Phase 5 handoff: files created/modified, the calendar-month reconciliation decision + Constitution amendment, and the exact next step (operator runs quickstart Part B on the Pi)
- [ ] T043 [Pi-only] Operator executes `specs/005-polish-hardening/quickstart.md` Part B (fresh-Pi E2E, FR-018) on the Pi and records completion in `docs/progress-log.md`. **Blocked by Phase 4's Pi deployment/validation** (backup timer + log must be live per `docs/progress-log.md`) — this task cannot be completed locally.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. Small; unblocks US3 config use.
- **User Stories (Phase 3–6)**: All depend on Setup (+ US3 on Foundational). US1, US2, US3, US4 are independent and can be worked in parallel; recommended sequential order P1 → P2 → P3 → P4.
- **Polish (Phase 7)**: Depends on all targeted stories being complete.

### Key within-story dependencies

- **US1**: T004/T005/T006 (tests) → T007 → T008 (backend) ; T009 → T010 → T011 → T012 (frontend).
- **US2**: T013–T017 (tests) → T018 (current-month helper) blocks T019/T020/T021 ; T022 → T023 (frontend). T024 (governance) after the behaviour lands.
- **US3**: T025–T027 (tests) → T028 → T029 → T030 (backend) ; T031 → T032 (frontend); T033/T034/T035 independent error-state edits.
- **US4**: docs only; best written after US1–US3 behaviour is settled so the guide is accurate.

### Parallel Opportunities

- Setup: T002 [P] alongside T001.
- All test tasks marked [P] within a story can be written together before that story's implementation.
- Across stories: US1 (backend auth + frontend gate) and US3 (backup status) touch disjoint files and can run in parallel once Setup/Foundational are done.
- Mutation-test tasks T038 [P] / T039 [P] run in parallel in Polish.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 (US1 PIN gate).
2. **STOP and VALIDATE**: PIN gate works end-to-end (quickstart A1).
3. Deploy/demo if desired — the app now has an access lock.

### Incremental Delivery

US1 (access lock) → US2 (historical-data safety, the calendar-month reconciliation) → US3 (resilience + backup visibility) → US4 (operability docs) → Polish gates. Each story is an independently testable increment.

### ⚠️ Highest-risk story

**US2** is the cross-phase change: it supersedes shipped Phase 2 (`useMonths`) and Phase 3 (Claude write target) behaviour and amends the constitution wording (T024). Land T018 (the single current-month helper) first and route every write path through it so the UI, backend guard, and Claude cannot drift to different "current months".

---

## Notes

- [P] = different files, no dependencies. [Story] label maps each task to US1–US4 for traceability.
- **Canonical term**: "current month" ≡ the current calendar month (local `YYYY-MM`); "editable month" and "current calendar month" are synonyms — use one concept across code, tests, and UI copy.
- Verify every test FAILS before implementing (Constitution Principle I, non-negotiable).
- No database schema change and no new dependencies in this phase.
- Commit one logical change per commit; do not commit with failing linters or tests.
- The fresh-Pi E2E (T043) and the backup end-to-end are Pi-only — never run `scripts/backup.sh`/systemd locally (FR-014).
