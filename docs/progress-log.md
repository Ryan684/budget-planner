Budget Planner — Progress Log
This file is updated by Claude Code at the end of every session. It is the authoritative record of what has been built, what decisions were made during implementation, and where the next session should start.

Claude Code reads this file at the start of each session to understand current project state. Keep entries specific — function names, file paths, and concrete decisions rather than vague summaries.

---

## Current Status

**Phase:** ✅ Phase 1 (Data Layer) — complete
**Last updated:** 2026-05-30
**Next session goal:** Begin Phase 2 (Core UI). Run `/speckit-specify` for `002-core-ui` (per-feature branch), then plan/tasks/implement the React + Vite frontend against the live backend API.

---

## Phase Completion Log

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

## Known issues / intentional oddities (do NOT "fix")

- **Orphaned amendment `entity_id`:** `amendments.entity_id` is a plain Integer, *not* an enforced FK. Deleting a bill/income/account intentionally leaves its amendment rows in place (append-only audit trail). This is by design — do not add a cascade or FK constraint.
- **No "month created" amendment:** carrying forward inserts new income/bill rows but logs no amendment for the month creation itself (no valid `entity_type` for "month"). Intentional.
- **mutmut 3.x false survivors:** 10 `crud.py` mutants report "survived" but are killed by the suite when applied directly — a mutmut 3.5.0 test-selection limitation, documented with evidence in `MUTANTS.md`. Not a coverage gap.
- **mutmut config must use lists:** `paths_to_mutate` and `tests_dir` must be TOML lists, not comma-strings, or mutmut 3.x mutates the whole project / mis-parses the tests dir.

## Starting point for next session (Phase 2)

1. `cd` to repo root; the backend runs with `cd backend && uvicorn main:app --reload --port 8000` (boots, `/api/health` → 200, OpenAPI at `/docs`).
2. Start the Spec Kit flow for Phase 2: `/speckit-specify` describing the Core UI (Dashboard, Income, Bills, Accounts, Month Management, Amendments screens — mobile-first React + Vite + TypeScript, no Claude yet), which creates branch `002-core-ui` + `specs/002-core-ui/`.
3. Then `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`.
4. Frontend consumes the existing API; Vite proxies `/api` → `:8000` (see CLAUDE.md). Reuse the budget figures from `GET /api/months/{id}/summary` and `/detail`; never recompute from stale client data.

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
