Budget Planner — Progress Log
This file is updated by Claude Code at the end of every session. It is the authoritative record of what has been built, what decisions were made during implementation, and where the next session should start.

Claude Code reads this file at the start of each session to understand current project state. Keep entries specific — function names, file paths, and concrete decisions rather than vague summaries.

---

## Current Status

**Phase:** 🟡 Phase 5 (Polish & Hardening) — **code-complete, all automated gates green; Pi-only manual gate remaining.** Backend 183 pytest, ruff clean, mutmut on the Phase 5 modules (3 documented equivalent survivors in `backup_status.py`; `routers/deps.py` "no tests" verified as a tool false negative). Frontend 204 Vitest, ESLint + `tsc --noEmit` clean, Stryker 85.63% (up from 70.96%). Quickstart Part A executed locally against a live backend — every PIN, read-only, error-state and backup-banner case behaved as specified, and the built bundle contains no PIN. **T043 (quickstart Part B, the fresh-Pi end-to-end) is Pi-only and not yet executed**, and it is still blocked by Phase 4's Pi deployment. Phase 4's Pi-only backup/recovery gates remain outstanding. All feature PRs to date (Phase 2 #4, Phase 3 #5, Phase 4 #7, Phase 5 #8) are **merged to `main`** — no open PRs remain.
**Also:** the shared-Pi reconciliation (2026-08-17, below) is committed and pushed but **not yet deployed** — it changes this app's port to 8001 and removes the `budget-frontend` service.
**Last updated:** 2026-08-17
**Next session goal:** Execute the Pi-only manual gates on the Pi, in this order: (1) the shared-Pi migration in `family-dashboard/PI_SETUP.md` Part 19 — the dashboard must be moved to `127.0.0.1`, Python moved to uv and the overnight Chromium stop installed *before* this app is deployed alongside it; (2) Phase 4's backup end-to-end + recovery test (`specs/004-backup-automation/quickstart.md` §3–§4), since Phase 5's backup banner depends on a live `BACKUP_LOG_FILE`; (3) Phase 5's `specs/005-polish-hardening/quickstart.md` Part B — the 11-step fresh-Pi checklist now mirrored in the README's "End-to-end validation checklist", **on port 8001**. Record completion of all three here. No PRs need opening for prior work — all of it is already merged; the shared-Pi branch below is the only outstanding one.

---

## Phase Completion Log

### 🔧 Shared-Pi reconciliation — budget planner + family dashboard on one Pi (2026-08-17)

Branch `claude/budget-dashboard-hardware-compat-trxsp3`. Not a Spec Kit phase — a
cross-cutting infrastructure change spanning this repo and `ryan684/family-dashboard`,
so it does not follow the `NNN-short-name` branch convention (the session prompt fixed
the branch name). Prompted by buying the Pi: a **4GB** Pi 5, now confirmed as the
hardware for both apps.

**The blocking problem:** both backends were configured to bind `0.0.0.0:8000`. Whichever
systemd unit started second would have failed with "address already in use" and
crash-looped under `Restart=on-failure`. Neither repo knew about the other.

**What changed here:**

- `backend/main.py` — `mount_frontend(target, dist_dir) -> bool` and `DIST_DIR`. The
  backend now serves the built frontend itself, so the app is one process on one port.
  Mounted at `/` (not `/assets`) because Vite copies `public/` — `favicon.svg`,
  `icons.svg` — into the dist root, and registered *after* every router because a mount
  at `/` is greedy for unmatched paths. No `dist/` (development) is a clean no-op.
- `backend/tests/test_static_ui.py` (NEW) — 9 tests: index/assets/public serving, API not
  shadowed, both unmounted cases, and `DIST_DIR`'s location.
- `docs/budget-planner.feature` — new `Feature: Shared-Pi Deployment` (5 scenarios;
  the port-collision one is operator-verified, like the fresh-Pi and Tailscale scenarios).
- **Port 8000 → 8001**, dev and production: `frontend/vite.config.ts`, README, CLAUDE.md,
  `specs/005-polish-hardening/quickstart.md`.
- `scripts/systemd/budget-backup.timer` — **02:30 → 03:30**. The dashboard's deploy timer
  fires at 02:00 and its `npm ci` + `vite build` can run 15–30 minutes on this hardware.
- `backend/requirements.lock` (NEW) — generated with
  `uv pip compile --universal --python-version 3.14`. The Pi installs from it instead of
  resolving fresh. `pyproject.toml` gained version floors, including `starlette>=1.0.1`
  for CVE-2026-48710, matching the floor family-dashboard already sets.
- `scripts/assert-not-pi.sh` (NEW) — refuses to run on Raspberry Pi hardware (reads
  `/proc/device-tree/model`; `ALLOW_PI_HEAVY_TESTS=1` overrides). Wired into
  `npm run test:mutation`.
- `.specify/memory/constitution.md` → **v1.3.0**, mirrored in CLAUDE.md.

**In `ryan684/family-dashboard` on the same branch:** `scripts/stop-kiosk.sh` (NEW, kills
Chromium at 22:00 to free ~0.5GB across the nightly window), memory caps on the deploy
unit, a Node heap cap in `deploy.sh`, the backend moved to `127.0.0.1:8000`, pyenv → uv,
the USB SSD added to the hardware BOM, and `PI_SETUP.md` Parts 19–20 (migration for a
running Pi; zram, service trimming and logrotate).

**Verification:** backend 192 pytest (183 + 9 new), ruff `check` + `format --check` clean;
frontend 204 Vitest, ESLint and `tsc --noEmit` clean. The static-serving change was also
verified end to end against a real `npm run build` and a live uvicorn on 8001: `/` and both
hashed assets 200 with correct MIME types, `favicon.svg` and `icons.svg` 200, `/api/health`
and `/api/months` 200 (not shadowed), path traversal and unknown paths 404.

**Caveat on the test runs:** this container has Python 3.11.15, not 3.14. The suite passes
there and no source uses 3.14-only syntax, but the gates have not been re-run on a 3.14
interpreter. Re-run `pytest` on the Pi or a 3.14 laptop before treating this as fully green.

**Deliberately not done:** moving the frontend builds off the Pi into CI. It is the biggest
remaining 4GB win — no `npm ci`, no `node_modules` on the SD card — but it touches CI in
both repos and belongs in its own change. The measures above already remove the memory
collision, so it is now an optimisation rather than a fix.

### 🟡 Phase 5 — Polish & Hardening: implementation (2026-07-27)

Branch `claude/speckit-phase-5-2fj6j7`. Tasks **T001–T042 complete**; **T043 is Pi-only and
outstanding** (see Current Status).

**What was built:**

*US1 — optional PIN gate*
- `backend/routers/auth.py` (NEW) — `GET /api/pin-required` (`{required: bool}`, never the PIN) and `POST /api/verify-pin` (`hmac.compare_digest` against `settings.app_pin`; `400` when unconfigured; a wrong PIN is `200 {"ok": false}`, not an HTTP error, so the UI can tell it apart from an unreachable backend).
- `backend/schemas.py` — `PinVerifyRequest` / `PinVerifyResponse` / `PinRequiredResponse` / `BackupStatusResponse`.
- `frontend/src/api/auth.ts`, `src/hooks/usePinGate.ts`, `src/components/PinGate.tsx` + `.module.css` (all NEW). `App.tsx` is now a thin wrapper rendering `<PinGate><BudgetApp/></PinGate>`.
- `backend/tests/test_auth.py`, `frontend/src/components/__tests__/PinGate.test.tsx` (NEW).

*US2 — one calendar-month definition of "current month"*
- `backend/current_month.py` (NEW) — `month_key(today)`, `current_month(session, today=)`, `current_month_id(session, today=)`. `today` is injectable so tests never touch the clock.
- `backend/routers/deps.py` — added `current_calendar_month_id` and `require_editable_month` (403 + `READ_ONLY_DETAIL`); `latest_month_id` kept **only** for stamping account amendments.
- `backend/routers/income.py` / `bills.py` — guard on create/update/delete, after the 404 lookup so a missing entity still wins.
- `backend/claude_context.py`, `backend/routers/claude.py` — `current_month_id` replaces `latest_month_id` for the Claude write target and the returned summary.
- `frontend/src/lib/dates.ts` — `currentMonthKey(now?)`, the browser-side mirror.
- `frontend/src/hooks/useMonths.ts` — `editableMonthId` is now the calendar-month match (null if absent); new `latestMonthId` for viewing.
- `frontend/src/screens/Dashboard.tsx` — "Create this month" prompt when `editableMonthId === null`; `App.tsx` falls back to viewing the newest month read-only.
- `backend/tests/test_current_month.py`, `test_read_only.py` (NEW); `frontend/src/hooks/__tests__/useMonths.test.ts` (NEW).

*US3 — error states + backup banner*
- `backend/backup_status.py` (NEW) — parses the Phase 4 log's last `SUCCESS`/`FAILED` line, computes staleness against `BACKUP_STALE_HOURS`; blank/missing/unreadable/unparseable/bad-timestamp all degrade to `unknown` (no banner).
- `backend/routers/system.py` (NEW) — `GET /api/backup-status`, always `200`.
- `backend/config.py` — `backup_log_file` (blank default) and `backup_stale_hours` (36).
- `frontend/src/api/system.ts`, `src/components/BackupBanner.tsx` (NEW), rendered on the dashboard.
- `frontend/src/api/client.ts` — 10s `AbortController` timeout (`REQUEST_TIMEOUT_MS`) mapping timeouts and network failures to a retryable `ApiError(0, …)`.
- `frontend/src/hooks/useClaudeSession.ts` + `screens/Claude.tsx` — `send` returns a boolean; on failure the optimistic user bubble is dropped, the conversation is kept, and the screen restores the draft.
- `frontend/src/screens/Income.tsx` / `Bills.tsx` / `Accounts.tsx` — a failed write now refetches so no stale optimistic value is left.
- `backend/tests/test_backup_status.py`, `frontend/src/api/__tests__/client.test.ts`, `src/components/__tests__/BackupBanner.test.tsx` (NEW).

*US4 — operability docs*
- `README.md` — full fresh-Pi guide (prerequisites, USB SSD via fstab, backend install, `.env.production`, frontend build, both systemd units, backup timer, Tailscale), a configuration reference table, the 11-step end-to-end validation checklist, and a local-development section.
- `docs/budget-planner.feature` — `Feature: Polish & Hardening` block added first, before any code.

**Gates:** ruff check + format clean; 183 pytest. ESLint + `tsc --noEmit` clean; 204 Vitest.
mutmut (pinned 3.5.0) on the Phase 5 modules; Stryker 85.63%. `MUTANTS.md` and
`frontend/MUTANTS.md` both updated. Quickstart Part A executed against a live backend.

**Two real defects found by mutation testing and fixed (not just documented):**
- `apiFetch` spread `...init` **after** `headers`, so a caller-supplied `headers` silently replaced the JSON content type — and the newly added abort `signal` would have been dropped the same way. `init` is now spread first.
- `BackupBanner`'s "no banner" assertions queried before the status fetch settled, so they passed for the original *and* the mutant. They now wait for the fetch and flush React.

**Decisions / assumptions:**
- The current month is derived from **local** time, not UTC ("this month" is a local human concept; UTC would flip the month up to an hour early/late at a boundary). The Constitution's "timestamps stored UTC" rule governs stored timestamps, not this interaction concern.
- The PIN gate **fails closed**: if `GET /api/pin-required` cannot be reached, the app stays locked with a retryable error rather than revealing data.
- `mutmut` is now pinned to `==3.5.0` — 3.6.0 cannot import unmutated modules from its copied `mutants/` tree. `[tool.pytest.ini_options] pythonpath` gained `".."` for the same reason (inside `mutants/`, `"."` supplies the mutated modules and `".."` the rest).
- Stryker's `mutate` scope widened beyond `src/lib` to the new `client.ts` / `usePinGate` / `useMonths` / `BackupBanner` logic. Both `stryker.conf.json` and `stryker.config.json` were updated (the repo carries both).
- `frontend/src/components/Banner.tsx` gained `role="status"` so banners are assertable and announced.
- Tests that hardcoded `2026-06` as "the current month" now use `CURRENT_MONTH` / `PREVIOUS_MONTH` from `tests/factories.py`, since the editable month tracks the real clock.

**Intentional (do NOT "fix"):**
- `routers/accounts.py` still uses `latest_month_id`. Accounts are not month-scoped; that call only stamps the amendment with the month in view. Routing it through the calendar month would make account amendments unstamped whenever today's month has not been created — a behaviour change with no requirement behind it.
- `test_amendments_scoped_to_month` seeds the previous month's amendment via `crud.update_entity` rather than HTTP. That is deliberate: the previous month is no longer writable over the API, and the test is about the listing's month filter.
- A wrong PIN returns `200 {"ok": false}`, not `401`. This is contractual — the frontend must distinguish "wrong PIN" from "server unreachable".
- `PinGate` deliberately leaves the entered PIN in the box after a failed attempt so it can be corrected and resubmitted; the unlock button therefore stays enabled.
- The rest of the API remains unauthenticated. The PIN is a convenience lock behind the LAN/Tailscale boundary, per the spec's accepted MVP posture — not an access-control mechanism.

### 🟡 Phase 4 — Backup Automation: implementation (2026-06-28)

Branch `feature/004-backup-automation`. Tasks **T001–T021 complete** (automated portion).
The Pi-only end-to-end and recovery tests (quickstart §3–§4, FR-012) are **not yet run** —
they must be executed by the operator on the Pi and recorded here.

**What was built:**
- `backend/backup.py` (NEW) — testable backup logic: `copy_database` (SQLite online-backup; rejects a missing/zero-length source), `verify_integrity` (`PRAGMA integrity_check`), `build_export` (envelope `{exported_at, schema_version: 1, data: build_budget_context(session)}`), `write_export` (serialise + `json.loads` re-parse verify *before* writing), `run_backup`, and a thin `main()` CLI that catches `BackupError` → stderr + `sys.exit(1)`.
- `backend/tests/test_backup.py` (NEW) — 11 tests: copy round-trip, integrity-detects-corruption, export envelope shape, JSON-verify-rejects-malformed, empty-DB, no-secrets, missing/zero-length source, CLI success path, CLI required-args.
- `backend/tests/conftest.py` — added the `seeded_db` fixture (file-backed SQLite + session, exposing `.session` and `.db_path`).
- `scripts/backup.sh` (NEW) — Pi-only orchestrator: `flock` guard, runs `backup.py`, explicit `git add` (never `-A`), clean no-change exit, commit+push, timestamped `SUCCESS`/`FAILED` to the local log on **every** exit path.
- `scripts/systemd/budget-backup.service` + `budget-backup.timer` (NEW) — `oneshot` service (`User=pi`, EnvironmentFile + ExecStart under `/home/pi/projects/budget-planner`) and nightly timer `OnCalendar=*-*-* 02:30:00` with `Persistent=true` (catch-up, FR-001).
- `scripts/backup-repo.gitignore` (NEW) — ignore-all-except-artifacts for the backup repo (secret-leak guard, FR-007).
- `README.md` (NEW) — Backup & Recovery: Pi setup, systemd install, verify, recovery procedure, JSON-only fallback.
- `docs/budget-planner.feature` — replaced the stale `Feature: Backup` block with clarified US1/US2/US3 scenarios.
- `backend/pyproject.toml` — added `backup.py` to `[tool.mutmut] paths_to_mutate`.
- `MUTANTS.md` — Phase 4 section: 31 `backup.py` survivors, all equivalent/cosmetic.

**Gates:** ruff clean; 130 pytest pass; mutmut full run 1150 mutants / 861 killed; `backup.py` 31 documented survivors (no behavioural gap).

**Spec remediation applied before coding (from `/speckit-analyze`):** T010 reworded to separate `BackupError`-raising functions from the CLI exit (A1); added T009a missing/zero-length-source test (G1); CLAUDE.md cron→systemd reconciled (I1); FR-004 amendments scope added (I2).

**Decisions / assumptions:**
- Pi deploy path `/home/pi/projects/budget-planner` and service user `pi` were chosen by the user (needed for absolute `ExecStart`/`EnvironmentFile`/`User=` in the `.service` unit).
- `backup.py` functions **raise** `BackupError`; only `main()` converts to a non-zero exit (keeps the logic unit-testable).
- The `seeded_db` fixture is **file-backed** (not in-memory) so the online-backup copy can read the source file.

**Intentional (do NOT "fix"):**
- `scripts/backup.sh` + systemd units are **Pi-only**, never run in CI/local (FR-014); verified manually on the Pi.
- The 31 surviving `backup.py` mutants are equivalent/cosmetic (CLI help/description text, error-message strings, JSON whitespace, case-insensitive SQL/codec, stderr diagnostics, export-timestamp tz) — documented in `MUTANTS.md`; do not chase them.

**Next (Pi-only, operator):** run quickstart §3 (trigger the service, confirm a GitHub commit + `SUCCESS` log) and §4 (recovery + JSON-fallback), then record completion here.

### ✅ Phase 3 — Claude Integration: manual validation T036 (2026-06-24)

Branch `claude/speckit-specify-web-check-1xj6ix`. T036 completed via HTTP API against a seeded dev DB.

All 12 quickstart scenarios passed against a live `claude-sonnet-4-6` call with the real API key:

| Scenario | Result | Notes |
|---|---|---|
| Surplus question | PASS | £4,745 correct, no write |
| Savings balance + as-of date | PASS | £8,500 + 2026-06-24 shown |
| Savings forecast | PASS | Computed from recorded balance, not invented |
| Broadband bill (absent) | PASS | "no broadband bill recorded" |
| Add £45 water bill | PASS | Intent + surplus effect stated, bill written, amendment logged `source=claude` |
| Update savings to £8,900 | PASS | Snapshot row written, balance updated |
| Ambiguous insurance bill | PASS | Asked which one; no write until clarified (minor: ID displayed same for both in text) |
| Undo last Claude change | PASS | Write reverted, surplus snapped back, reversal logged as new row |
| Three turns, undo most recent only | PASS | Only turn C reverted; turns A and B untouched |
| Manual edit + Claude write + undo | PASS | Manual mortgage edit preserved; only Claude broadband bill reverted |
| Previous month write refused | PASS | "read-only" message, May data unchanged |
| Cross-month comparison | PASS | May vs June table with deltas |
| Missing month graceful | PASS | "no April data" — no error, no invented figure |

Dev DB seeded with: 2 months (2026-05 May, 2026-06 June), 4 income entries, 11 bills (including 2 insurance bills for ambiguity test), 2 accounts (Savings £8,500, Current £2,400) + snapshots.

**Files modified**: `specs/003-claude-integration/tasks.md` (T036 marked complete), `docs/progress-log.md`.
**Backend db backup**: `backend/data/budget-dev.db.bak` (pre-seed state preserved).

### ✅ Phase 3 — Claude Integration: mutation gate (2026-06-21)

Branch `claude/speckit-specify-web-check-1xj6ix`. Tasks T033 and T034 completed.

**Backend mutmut** (re-run after new tests): 1039 mutants, 790 killed, 243 survived, 6 "no tests".
All survivors documented in `MUTANTS.md` (Phase 3 section — Groups A–I). No undocumented survivors remain.

Five new tests added to close genuine behavioral gaps found during triage:
- `test_delete_bill_in_current_month` — verifies source/reason/month_id for delete_bill amendments
- `test_update_account_balance_tool` — verifies source/reason/month_id/old/new for account balance tool
- `test_add_income_writes_with_claude_source_and_reason` — killed _add_income coverage gaps
- `test_update_income_in_current_month` — killed _update_income coverage gaps (was zero-tested)
- `test_cannot_update_income_from_previous_month` — killed month-scope guard gaps for income
- `test_is_stale_boundary` (earlier session) — killed is_stale >= boundary mutant
- Extended `test_context_includes_full_financial_picture` with exhaustive field assertions

**Frontend Stryker**: 147 mutants, 132 killed, 15 survived (89.80%). 5 new survivors in
`amendments.ts` from Phase 3's entityLabel parsing code (line 33 regex + MONEY_FIELDS).
All documented in `frontend/MUTANTS.md` (Phase 3 section). All accepted as display-layer helpers.

**Files modified this session**: `backend/tests/test_claude_tools.py`,
`backend/tests/test_claude_context.py`, `backend/tests/test_amendment_logging.py`,
`MUTANTS.md`, `frontend/MUTANTS.md`, `specs/003-claude-integration/tasks.md`,
`docs/progress-log.md`.

**Remaining**: T036 (live-app quickstart validation) deferred — needs real ANTHROPIC_API_KEY and browser.

### ✅ Phase 3 — Claude Integration: implementation (2026-06-20)

`/speckit-clarify → plan → tasks → analyze → implement` on branch
`claude/speckit-specify-web-check-1xj6ix`. All 37 tasks T001–T032 done; T033–T037 (quality
gates / handoff) partially done — see Current Status. Anthropic API is **mocked in every test**.

**New backend modules**
- `claude_context.py` — `build_budget_context(session)` assembles the privacy-bounded payload
  (all months + income/bills/surplus, accounts with `is_stale` via the 30-day rule, the
  `balance_snapshots` series, and the amendments log). Deterministic key order. Excludes the DB
  file, secrets, `.env`, and PIN (asserted in `test_claude_context.py`).
- `claude_tools.py` — seven tools (`add/update/delete_bill`, `add/update/delete_income`,
  `update_account_balance`), each requiring a `reason`, **no `month_id` exposed**. `dispatch()`
  resolves the current month server-side, enforces month scoping, and writes via `crud` with
  `commit=False`. Problems raise `ToolDispatchError`.
- `claude_client.py` — `run_turn(session, request)`: builds the system prompt (CLAUDE.md rules +
  stale-on-write + comparison/no-prior-month guidance), runs a **manual** tool-use loop against
  `claude-sonnet-4-6` (non-streaming), trims oldest conversation turns via `count_tokens` when over
  `MAX_INPUT_TOKENS` (financial context never trimmed), maps `anthropic.AnthropicError` →
  `AssistantUnavailable`. `create_anthropic_client()` is the patch point for tests.
- `routers/claude.py` — `POST /api/claude` (orchestrates the turn; commits on success, rolls the
  whole turn back on any tool error → atomic; returns reply + `writes[]` + recalculated summary;
  502 on `AssistantUnavailable`) and `POST /api/claude/undo` (reverses the given turn's amendments
  newest-first as **new** reversing amendments — append-only — `source="claude"` only).

**Data layer**
- `models.py` — new append-only `AccountBalanceSnapshot` (`account_id`, `balance`, `as_of_date`,
  `recorded_at`; `account_id` is a plain int, not an FK, mirroring `Amendment`).
- `crud.py` — `create/update/delete_entity` gained a `commit: bool = True` flag (Claude batches a
  turn into one transaction); a snapshot row is written on every `account_balance` create and on any
  update that changes a field.
- `config.py` — `anthropic_api_key` setting (blank → friendly 502).
- `pyproject.toml` — `anthropic` runtime dep; new modules in `py-modules` and `[tool.mutmut]`.

**Frontend**
- `api/claude.ts` (`postClaudeMessage`, `undoLastClaudeChange`), `api/types.ts` (Claude + snapshot
  types), `hooks/useClaudeSession.ts` (session conversation + per-turn write list + `canUndo` +
  `send`/`undoLast`; resets on unmount), and `screens/Claude.tsx` (chat UI: bubbles, error banner,
  conditional "Undo last Claude change", composer) replacing the placeholder.

**Tests added**: `test_account_snapshots.py`, `test_claude_context.py`, `test_claude_tools.py`,
`test_claude_api.py` (query / write / undo / cross-month, all with `tests/fake_anthropic.py`), and
`screens/__tests__/Claude.test.tsx`.

### 🟦 Phase 3 — Claude Integration: spec + AI-boundary ADR amendment (2026-06-18)

Spec-only session, no code. Branch `claude/speckit-specify-web-check-1xj6ix`.

**`/speckit-specify` → `specs/003-claude-integration/`** — drafted `spec.md` (4 prioritised user
stories: P1 querying, P2 confirm-then-act writes, P3 undo, P3 cross-month trends; FR-001–FR-022;
SC-001–SC-007) and `checklists/requirements.md` (all items pass). `.specify/feature.json` repointed
from `specs/002-core-ui` → `specs/003-claude-integration`.

**AI-boundary ADR widened (user decision).** Claude's *read* context expanded from "current month +
one explicitly requested prior month" to the household's **full multi-month financial picture** (all
months' budgets + all account balances and their history). Writes are unchanged — current month
only; previous months stay read-only. Boundary now excludes only the raw DB file, secrets, `.env`,
and PIN. Amended in lockstep across all four governing docs: constitution Principle IV (renamed
*Privacy & Minimal AI Context* → *Privacy & AI Data Boundary*, **v1.0.0 → v1.1.0**),
`docs/budget-planner-spec.md` (AI Boundary section + Phase 3 / Claude-screen lines), `CLAUDE.md`
(Privacy boundary + runtime system prompt), and the 003 spec.

**✅ Resolved (2026-06-18):** A dedicated append-only `account_balance_snapshots(id, account_id,
balance, as_of_date, recorded_at)` table will be added. A row is written on every balance update,
giving Claude a correctly-dated, first-class time series for trend analysis. Added to the project
spec data model, FR-023 and a new Key Entity added to the 003 spec, and a new Spec Divergence row
added below. Phase 3 planning must include the schema addition and the write-path change in
`accounts.py`/`crud.py`.

### ✅ Phase 2 — Core UI post-implementation bug fixes (2026-06-14)

Two bugs found during live testing, fixed in a follow-up commit on the same branch (PR #4):

**Bug 1 — Amendments log showed nothing (bare entity IDs)**
All 5 dev-DB rows had been written before the previous session's `_entity_summary` fix. Their
`new_value` was a plain integer (`"1"`, `"2"`, etc.), which `getLifecycleValue` correctly filtered,
leaving the page empty. Fix: dropped and recreated the dev DB from the updated schema (no migration
needed at this stage of development).

**Bug 2 — Field-update amendments had no entity context**
`update_entity` logged `field_changed="amount"` with numeric old/new values but no record of
*which* bill or income entry was changed. Fix: added `entity_label TEXT` (nullable) to the
`Amendment` model; all three CRUD helpers (`create_entity`, `update_entity`, `delete_entity`) now
pass `getattr(entity, "label", None)`. The amendments screen shows the label inline for update
events only — lifecycle events already embed the name in their summary value.

Files changed: `backend/models.py`, `backend/crud.py`, `backend/schemas.py`,
`backend/tests/test_amendment_logging.py`, `frontend/src/api/types.ts`,
`frontend/src/lib/amendments.ts`, `frontend/src/lib/__tests__/amendments.test.ts`,
`frontend/src/screens/Amendments.tsx`, `frontend/src/screens/Amendments.module.css`.

**Quality gates (post-fix):** `ruff` clean · `pytest` 72/72 · ESLint + `tsc` clean · Vitest 144/144.

**SDD housekeeping:** three Gherkin scenarios added to `docs/budget-planner.feature` under
Amendments Log to capture the entity-name requirement that was implicit but unspecified.

### ✅ Phase 2 — Core UI (2026-05-31)

Implemented via Spec Kit `/speckit-implement` against `specs/002-core-ui/tasks.md` (T001–T069).
Branch `claude/budget-planner-spec-phase-2-hChzu`. Mobile-first React + Vite + TypeScript frontend
over the Phase 1 API — no Claude yet. **135 tests across 14 files, all green; mutation score 91.60%
on `src/lib/`; lint + `tsc` + production build all clean.**

**Toolchain / setup (`frontend/`):**
- Vite + React + TypeScript (strict), Vitest + React Testing Library + jsdom, StrykerJS (vitest runner).
- `vite.config.ts` — `/api` proxy → `:8000`; Vitest jsdom config. **Imports `defineConfig` from
  `vitest/config`** (not `vite`) so the `test` key type-checks under `tsc -b` at build time.
- `stryker.config.json` — vitest runner, `mutate: ["src/lib/**/*.ts"]`, html+clear-text reporters.
- `tokens.css` design tokens; `eslint.config.js` (disabled over-broad `react-hooks/set-state-in-effect`;
  `argsIgnorePattern: '^_'` for intentionally-unused params).

**API layer (`src/api/`):** `types.ts` (mirrors `backend/schemas.py` verbatim — `is_recurring`,
`due_date`, `as_of_date`, `account_type`), `client.ts` (`apiFetch<T>` + `ApiError`; 409→"That month
already exists", 404→"Not found", 422→extracted FastAPI detail; `ApiError` uses explicit field
declarations, **not** TS parameter properties — required by `erasableSyntaxOnly`), and per-entity
modules `months.ts` / `income.ts` / `bills.ts` / `accounts.ts` / `amendments.ts`.

**Shared logic (`src/lib/`, mutation-tested):** `format.ts` (`gbp` → `£X,XXX.XX`, negative `-£` red;
`fmtTimestamp`), `dates.ts` (`daysAgo`, `isStale` ≥30, `nextMonthString`, `fmtAsOf`), `amendments.ts`
(`mapAmendment` → verb/`entityType`/`sourceLabel`/from→to/reason/local ts), `projected.ts`
(`calcProjectedSurplus`), `categories.ts` (6 suggested categories + colour dots, `getDot`,
`categoryOrder`).

**Hooks (`src/hooks/`):** `useMonths` (derives `editableMonthId` = latest month, `isReadOnly(id)`),
`useMonthDetail`, `useAccounts`, `useAmendments` — each `{ data, loading, error, refetch }`; every
write calls `refetch()` so figures come fresh from the API.

**Components (`src/components/`):** `Icon` (inline SVG set; now accepts `style`), `Money`, `SurplusBar`,
`Card` (accepts `number | string` pad), `Banner`, `StatusPill`, `Button`, `Row`, `SectionLabel`,
`StateView` (shared loading / error+retry / empty), form primitives (`Sheet`, `Field`, `TextInput`,
`MoneyInput`, `Toggle`), `ItemSheet` (single component, income/bill/account modes), `NavHeader`, `TabBar`.

**Screens (`src/screens/`):** `Dashboard` (navy hero + month switcher + `StatusPill` + `SurplusBar`,
receipt card, accounts card w/ stale count, Ask-Claude card, Manage list, read-only banner),
`EmptyState`, `Income`, `Bills` (category grouping + subtotals + over-budget banner), `Accounts`
(freshness dots + Stale pills — **not month-scoped, always editable**), `MonthManagement`
(`MonthsList` + `CreateMonthFlow` carry-forward with live projected surplus), `Amendments`, `Claude`
(inert "Coming in Phase 3"). App shell in `App.tsx` (screen-state machine, `activeMonthId` vs
`editableMonthId`, `readOnly` enforcement, TabBar host).

**Repo:** `frontend/MUTANTS.md` (10 surviving `lib/` mutants documented as acceptable — locale/Date
normalisation invisible in the test env, and internal display-helper branches in `parseValue`).

**Quality gates:** `npm run lint` clean · `npx tsc --noEmit` clean · `npm run build` clean ·
`npm run test` 135/135 · `npm run test:mutation` 91.60% (109 killed / 10 survived, all documented).

**Deferred (require a running app, not available in this container):** T066 mobile-viewport pass,
T067 visual review vs `docs/mockup/`, T068 quickstart smoke checklist against the live backend.

### ✅ Phase 1 — Data Layer (2026-05-30)

Implemented via Spec Kit `/speckit-implement` against `specs/001-phase-1-data-layer/tasks.md` (T001–T019).

**Backend created (`backend/`):**
- `pyproject.toml` — deps + `[dev]` (pytest, httpx, mutmut, ruff); `[tool.mutmut]` scoped to budget/carry_forward/crud (paths_to_mutate + tests_dir as **lists** — required by mutmut 3.x).
- `config.py` — `Settings` (pydantic-settings): `database_url`, `app_pin`.
- `database.py` — engine (SQLite, `check_same_thread=False`), `SessionLocal`, `Base` (DeclarativeBase), `get_db`, `init_db`.
- `main.py` — FastAPI app, lifespan→`init_db`, `/api/health`, all routers registered.
- `models.py` — 5 ORM models: `BudgetMonth`, `IncomeEntry`, `Bill`, `AccountBalance` (+`account_type`), `Amendment` (append-only). UTC-aware timestamps via `_utcnow`.
- `schemas.py` — Pydantic v2 Create/Update/Read per entity + `BudgetSummary`, `MonthDetail`, `CarryForwardPreview`/`Item`/`Override`, `AccountList`, `AmendmentRead`. Validators: `amount/balance ge=0`, `month` regex, `due_date` 1–31, `Literal` types.
- `budget.py` — pure calc: `total_income`, `total_bills`, `monthly_surplus`, `total_balances`, `total_savings`.
- `crud.py` — generic `create_entity` / `update_entity` (per-field) / `delete_entity`, each writing an append-only amendment atomically. `source`/`reason` are params (Phase 3 Claude seam).
- `carry_forward.py` — `_previous_month` (most-recent `< target` by text sort), `preview`, `apply_carry_forward` (recurring-only, per-item override/exclude; accounts never touched; previous month never mutated).
- `routers/` — `months.py` (CRUD + `/summary` + `/detail` + `/carry-forward-preview` + create-with-carry-forward), `income.py`, `bills.py`, `accounts.py` (CRUD + totals + `active_month_id` stamping), `amendments.py` (read-only per month), `deps.py` (`get_or_404`, `latest_month_id`).
- `tests/` — `conftest.py` (in-memory SQLite via StaticPool, `db_session`, `client` with `get_db` override), `factories.py`, and 8 test modules. **72 tests, all passing.**

**Repo root:** `MUTANTS.md` (mutation results + survivor justifications). The detailed engineering plan lives in `specs/001-phase-1-data-layer/plan.md`.

**Quality gates:** `ruff check .` clean; `ruff format --check .` clean; `pytest` 72/72 green; `mutmut run` 272 mutants / 254 killed / 18 survived — all 18 documented in `MUTANTS.md` (8 equivalent, 10 mutmut-3.x false survivors verified killed by applying the mutation directly).

**Python version:** Targets **3.14** (`requires-python = ">=3.14"`, ruff `py314`), to match the
`family-dashboard` project / the Pi. This cloud container has no stable 3.14 — only the system
3.10–3.13 interpreters plus a `uv`-fetchable **3.14.0rc2**. The 72 tests + ruff were run green
against the source on the system interpreter; an attempt to run them under 3.14.0rc2 hit a
**Pydantic-vs-RC incompatibility** (Pydantic 2.13.4 calls `typing._eval_type(..., prefer_fwd_module=…)`,
a kwarg that 3.14.0**rc2** renamed/dropped — its signature is now
`(…, recursive_guard, format, owner, parent_fwdref)`). This is a release-candidate moving-target
issue, **not** a defect in our code; released Pydantic wheels match the *stable* 3.14.0 stdlib that
the Pi runs. **Action for deploy/CI:** run `pip install -e ".[dev]" && pytest` once on stable
3.14.0 to confirm before relying on it.

---

## Spec Divergences

| Divergence | Spec said | We did | Why |
|---|---|---|---|
| Backend test framework | "Vitest for Phase 1 calc" | **pytest** | The calc lives in Python; Vitest is frontend-only (Phase 2). Spec error. |
| Backend port (2026-08-17) | Spec and CLAUDE.md used `:8000` throughout | **`:8001`**, dev and production | The Pi is shared with the family dashboard, which was deployed first and owns 8000. Both binding `0.0.0.0:8000` meant the second service to start would crash-loop. Dev matches production so the two apps can also run side by side on a laptop. |
| Frontend serving (2026-08-17) | Spec Phase 0 and the README ran the built `dist/` behind a separate static server (`python3 -m http.server 5173`) | **FastAPI serves `dist/`** from the same process and port (`mount_frontend`); `budget-frontend.service` deleted | CLAUDE.md already allowed either. The static server was also broken: the bundle requests a relative `/api` (`frontend/src/api/client.ts`), which a static file server cannot answer, and the documented `API_BASE_URL` lacked the `VITE_` prefix Vite requires, so it was never read. Same origin fixes it, drops a port, a systemd unit and a process on a 4GB Pi, and needs no CORS config. `API_BASE_URL` is removed from the env. |
| Backup timer (2026-08-17) | Phase 4 set `OnCalendar=*-*-* 02:30:00` | **03:30** | The dashboard's nightly deploy fires at 02:00 and its `npm ci` + `vite build` can run 15–30 minutes on this hardware; 30 minutes was not enough clearance. |
| Mutation testing scope (2026-08-17) | Constitution II made mutation testing an unconditional gate | Still blocking for merge to `main`, but **never run on the Pi** | mutmut and Stryker will exhaust a 4GB Pi shared with a kiosk and two backends, and the OOM killer takes a live service with it. Constitution amended to v1.3.0; `scripts/assert-not-pi.sh` enforces it. |
| Python packaging (2026-08-17) | CLAUDE.md and Constitution said "no `requirements.txt`" | Added generated **`backend/requirements.lock`** | `pyproject.toml` stays the source of truth and now declares floors; the lock is its compiled output and is what the Pi installs from, so a deploy gets the versions that were tested. Matches family-dashboard. |
| Account schema | `account_balances` has no type column | Added **`account_type`** (`current`/`savings`) | Needed so `total_savings` (in the spec's budget logic) is computable. |
| Amendment scope | Feature file asserts logging on *edits* | Log **all** writes (create/edit/delete) | CLAUDE.md "every write logged" + append-only audit principle. |
| Account type selector (Phase 2) | research.md §8 anticipated a `current`/`savings` picker in the account sheet | **Deferred** — `ItemSheet` account mode collects label + balance only; `account_type` defaults server-side | No Phase 2 Gherkin scenario exercises the savings/current split; keeps the sheet minimal. Revisit if a savings-vs-current UI breakdown is wanted. |
| Amendment entity context | Feature file said "each entry shows source, field changed, old value, new value, reason, and timestamp" — entity name was absent | Added `entity_label` column to `Amendment`; store entity name on every write; display it in the UI for field-update events | Found during live testing: without the label you can't tell which bill or income entry was changed. Three Gherkin scenarios added retroactively to capture this requirement. |
| Dev DB migration strategy | N/A (early development) | Drop and recreate dev DB when schema changes rather than writing migration scripts | Too early in development for migrations to be worthwhile; schema is still fluid. Migrations will be necessary before any production deploy. |
| `vitest/config` import | scaffolded `vite.config.ts` used `/// <reference types="vitest" />` + `defineConfig` from `vite` | Import `defineConfig` from **`vitest/config`** | The triple-slash ref isn't picked up by `tsconfig.node.json` (`types: ["node"]`) during `tsc -b`, so the `test` key failed to type-check at build. |
| AI context boundary (Phase 3) | spec + constitution: Claude sent current month + one explicitly requested prior month ("minimal context") | Widened to the **full multi-month financial picture** (all months + account-balance history), read-only; writes still current-month only | User self-hosts and consents to analysis of their own finances; cross-month context is what makes forecasting/trends useful. Constitution bumped **v1.1.0**; all four governing docs amended together (2026-06-18). |
| Account balance history (Phase 3) | `account_balances` holds only the current balance; history was to be reconstructed from `amendments` | Add append-only **`account_balance_snapshots(id, account_id, balance, as_of_date, recorded_at)`** table; write a row on every balance update | Amendments log is not a reliable time series for balance history: create-amendments don't record a numeric opening balance, balance + as_of_date land in separate rows, and `amended_at` ≠ `as_of_date`. Snapshot table is the correct structure. |
| Transactional CRUD (Phase 3) | crud helpers committed per write | Added `commit: bool = True` to `create/update/delete_entity`; Claude's tool dispatch uses `commit=False` and the router commits/rolls back once per turn | Atomic multi-write turns (clarification 2026-06-20): any tool failure must roll the whole turn back. User writes keep the default `commit=True`, so existing behaviour is unchanged. |
| Claude error/refusal status (Phase 3) | contracts/claude-api.md sketched a 409 for mid-turn write failure | A tool failure is surfaced to Claude as a tool error; the whole turn is rolled back and the endpoint returns **200** with the model's explanation and `writes: []` (only outright API unavailability returns 502) | Letting Claude explain ("which insurance bill?", "I can't change a previous month") is friendlier than a raw 409 and still satisfies FR-015 (no data change, no amendment). The 409 path was an early design sketch, not a requirement. |
| Undo of a deletion (Phase 3) | FR-017 reverts "the most recent Claude write" generally | Undo handles **created** (delete the entity) and **field-update** (restore old value) reversals; undoing a Claude *deletion* returns 409 "not supported" | Re-creating a deleted entity from the amendment's summary string is lossy (category/recurring/due-date aren't recorded). No Gherkin undo scenario undoes a deletion. Revisit if needed (would require storing full entity state on delete). |
| Non-streaming responses (Phase 3) | not specified | `POST /api/claude` returns one complete JSON response per turn (no SSE) | Clarification 2026-06-20 — simpler on a Pi/LAN; streaming can be added in Phase 5 polish. |
| "Current month" definition (Phase 2/3, superseded in Phase 5) | Phase 2 `useMonths` and Phase 3 `latest_month_id` treated the **latest** month (`YYYY-MM` max) as the current/editable month | The current month is the month whose `YYYY-MM` equals the **current calendar month** in local time — one definition shared by the UI editable month, the backend income/bills read-only guard, the Claude write target, and the dashboard default (`backend/current_month.py`, `frontend/src/lib/dates.ts:currentMonthKey`) | The 2026-07-26 clarification requires editing to track the real calendar month, and the planning reconciliation requires a single definition so the UI and Claude cannot write to two different "current months". A future-dated month is now read-only until its month arrives, and when the calendar month does not exist nothing is editable (the dashboard offers to create it). Constitution Principle IV amended to **v1.2.0** with the `CLAUDE.md` mirror (both 2026-07-26). `latest_month_id` survives only to stamp account amendments with the month in view — it is no longer on any write path. |
| Scheduling mechanism (Phase 4) | spec + CLAUDE.md said "nightly **cron** job" | **systemd timer** `budget-backup.timer` (`OnCalendar=*-*-* 02:30:00` + `Persistent=true`) triggering `oneshot` `budget-backup.service` | The 2026-06-24 clarification requires a run missed while the Pi was off to catch up on next boot; plain cron can't. The Pi already runs the app under systemd, so a `Persistent` timer is the native, zero-extra-dependency fit. CLAUDE.md reconciled to "systemd timer" in this phase. |

## Known issues / intentional oddities (do NOT "fix")

- **Orphaned amendment `entity_id`:** `amendments.entity_id` is a plain Integer, *not* an enforced FK. Deleting a bill/income/account intentionally leaves its amendment rows in place (append-only audit trail). This is by design — do not add a cascade or FK constraint.
- **No "month created" amendment:** carrying forward inserts new income/bill rows but logs no amendment for the month creation itself (no valid `entity_type` for "month"). Intentional.
- **mutmut 3.x false survivors:** 10 `crud.py` mutants report "survived" but are killed by the suite when applied directly — a mutmut 3.5.0 test-selection limitation, documented with evidence in `MUTANTS.md`. Not a coverage gap.
- **mutmut config must use lists:** `paths_to_mutate` and `tests_dir` must be TOML lists, not comma-strings, or mutmut 3.x mutates the whole project / mis-parses the tests dir.

## Starting point for next session — SUPERSEDED

**This section is historical and stale — left over from the Phase 3 session (2026-06-20).**
Everything it describes is long done: Phase 3's mutation gates and live-app validation (T033–T036)
were completed the same week (see the Phase 3 entries below), and Phase 3's PR, along with Phase
2's PR #4, have both been merged, as have Phase 4's PR #7 and Phase 5's PR #8. **The "Current
Status" block at the top of this file is the authoritative next-step pointer** — do not follow the
steps below. Kept only for the orientation paragraph, which is still accurate.

**Quick orientation for whoever picks this up:** the whole feature funnels through
`backend/routers/claude.py`; the Anthropic interaction lives in `backend/claude_client.py`
(`create_anthropic_client` is the test patch point); writes are dispatched in
`backend/claude_tools.py` (no `month_id` is ever exposed — current-month-only by construction).
Frontend state is entirely in `frontend/src/hooks/useClaudeSession.ts`.

---

## End-of-Session Update Instructions (for Claude Code)

At the end of every session, before closing, update this file:

1. Change the phase status from ⬜ to ✅
2. Fill in "Completed" with specific files created/modified and functions implemented
3. Fill in "Decisions made during session" with anything that differs from or extends the spec
4. Fill in "Known issues / intentional oddities" with anything that looks wrong but is deliberate
5. Fill in "Starting point for next session" with the exact first thing the next session should do
6. Update the "Current Status" block at the top
7. Add any spec divergences to the Spec Divergences table
