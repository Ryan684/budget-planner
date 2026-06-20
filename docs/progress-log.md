Budget Planner — Progress Log
This file is updated by Claude Code at the end of every session. It is the authoritative record of what has been built, what decisions were made during implementation, and where the next session should start.

Claude Code reads this file at the start of each session to understand current project state. Keep entries specific — function names, file paths, and concrete decisions rather than vague summaries.

---

## Current Status

**Phase:** ✅ Phase 3 (Claude Integration) — **code + tests + linters green** (backend 110 pytest, frontend 153 vitest; ruff + ESLint + tsc clean). Mutation gate (mutmut/Stryker) and live-app validation (T036, needs a real `ANTHROPIC_API_KEY` + browser) still outstanding. Phase 2 live-app gates T066–T068 and PR #4 also still open.
**Last updated:** 2026-06-20
**Next session goal:** Finish the Phase 3 quality gates — run frontend Stryker (T034), review the mutmut survivors and record any accepted ones in `MUTANTS.md` (T033), then do the live-app validation (T036) with a real key. After that, open the Phase 3 PR. (Phase 2 PR #4 + T066–T068 remain open from before.)

---

## Phase Completion Log

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

## Known issues / intentional oddities (do NOT "fix")

- **Orphaned amendment `entity_id`:** `amendments.entity_id` is a plain Integer, *not* an enforced FK. Deleting a bill/income/account intentionally leaves its amendment rows in place (append-only audit trail). This is by design — do not add a cascade or FK constraint.
- **No "month created" amendment:** carrying forward inserts new income/bill rows but logs no amendment for the month creation itself (no valid `entity_type` for "month"). Intentional.
- **mutmut 3.x false survivors:** 10 `crud.py` mutants report "survived" but are killed by the suite when applied directly — a mutmut 3.5.0 test-selection limitation, documented with evidence in `MUTANTS.md`. Not a coverage gap.
- **mutmut config must use lists:** `paths_to_mutate` and `tests_dir` must be TOML lists, not comma-strings, or mutmut 3.x mutates the whole project / mis-parses the tests dir.

## Starting point for next session (finish Phase 3 quality gates)

Phase 3 code, tests, and linters are green. Remaining tasks in
`specs/003-claude-integration/tasks.md` are T033–T037:

1. **Mutation gates.** A mutmut run is/was in progress this session — review survivors:
   `cd backend && .venv/bin/mutmut results`, inspect each with `mutmut show <id>`, and record any
   genuinely-acceptable survivors in `MUTANTS.md` (id / what mutated / why acceptable). The log
   already notes a known mutmut-3.x false-survivor quirk for `crud.py`. Then run frontend Stryker:
   `cd frontend && npm run test:mutation` (T033/T034).
2. **Live-app validation (T036).** Needs a real `ANTHROPIC_API_KEY` in `.env.local` and a browser:
   - Terminal 1: `cd backend && uvicorn main:app --reload --port 8000` (the
     `account_balance_snapshots` table is created on startup; seed a month + income/bills/accounts).
   - Terminal 2: `cd frontend && npm run dev`, open the Claude tab.
   - Walk the `specs/003-claude-integration/quickstart.md` §5 table (query, write, undo, cross-month).
3. **Open the Phase 3 PR** once gates pass. Note Phase 2's PR #4 and live-app gates T066–T068 are
   still open from the prior session and may want resolving first.

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
