Budget Planner — Progress Log
This file is updated by Claude Code at the end of every session. It is the authoritative record of what has been built, what decisions were made during implementation, and where the next session should start.

Claude Code reads this file at the start of each session to understand current project state. Keep entries specific — function names, file paths, and concrete decisions rather than vague summaries.

---

## Current Status

**Phase:** ✅ Phase 2 (Core UI) — complete (code/tests/mutation gates green; live-app gates T066–T068 deferred — need a running backend + browser). Post-implementation bug fixes applied 2026-06-14; PR #4 open.
**Last updated:** 2026-06-14
**Next session goal:** Merge PR #4 → `main`, then run the deferred live-app gates (T066–T068), then begin Phase 3: `/speckit-specify` for `003-claude-integration`.

---

## Phase Completion Log

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

## Known issues / intentional oddities (do NOT "fix")

- **Orphaned amendment `entity_id`:** `amendments.entity_id` is a plain Integer, *not* an enforced FK. Deleting a bill/income/account intentionally leaves its amendment rows in place (append-only audit trail). This is by design — do not add a cascade or FK constraint.
- **No "month created" amendment:** carrying forward inserts new income/bill rows but logs no amendment for the month creation itself (no valid `entity_type` for "month"). Intentional.
- **mutmut 3.x false survivors:** 10 `crud.py` mutants report "survived" but are killed by the suite when applied directly — a mutmut 3.5.0 test-selection limitation, documented with evidence in `MUTANTS.md`. Not a coverage gap.
- **mutmut config must use lists:** `paths_to_mutate` and `tests_dir` must be TOML lists, not comma-strings, or mutmut 3.x mutates the whole project / mis-parses the tests dir.

## Starting point for next session (finish Phase 2 verification → Phase 3)

1. **Merge PR #4** (`claude/budget-planner-spec-phase-2-hChzu` → `main`) — the post-implementation
   bug fixes are pushed and all quality gates are green.
2. **Finish the deferred Phase 2 live-app gates (T066–T068)** — these need a running stack:
   - Terminal 1: `cd backend && uvicorn main:app --reload --port 8000` (seed a month + a few
     income/bills/accounts via `/docs` or the UI).
   - Terminal 2: `cd frontend && npm run dev`, open `http://localhost:5173`.
   - T066: DevTools device mode at 390×844 — confirm no horizontal scroll, touch targets ≥ ~44px.
   - T067: walk each screen side-by-side with `docs/mockup/` and reconcile spacing/tones.
   - T068: run the `specs/002-core-ui/quickstart.md` smoke checklist end-to-end.
   - Tick T066–T068 in `specs/002-core-ui/tasks.md` once verified.
3. **Begin Phase 3 (Claude integration):** `/speckit-specify` for `003-claude-integration`
   (chat UI, context injection, confirm-then-act direct writes, session-scoped undo), then
   `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`. Runtime model is
   `claude-sonnet-4-6`; calls go only through `/api/claude` (see the Claude Integration ADR in CLAUDE.md).

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
