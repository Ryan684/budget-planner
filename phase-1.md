# Phase 1 — Backend Data Layer (Family Budget Planner)

## Context

The repo is fully specified but **greenfield** — only `docs/` and `CLAUDE.md` exist; zero
application code. This plan implements **Phase 1 only** (the data layer), the foundation
every later phase builds on. Phase 0 (Pi infra) and Phase 4 (backup) are **deferred** — they
can't be meaningfully run or tested in this ephemeral cloud container. No frontend (Phase 2)
and no Claude integration (Phase 3) here.

Goal: a runnable, fully-tested FastAPI + SQLAlchemy backend that persists all five tables,
exposes CRUD for every entity, computes budget totals, handles month carry-forward, and
records an append-only amendment log on every write. Work follows CLAUDE.md's mandatory build
order: **Gherkin (already exists) → failing tests → minimal code → mutation tests → MUTANTS.md
→ progress-log**.

Source of truth: `docs/budget-planner-spec.md`, `docs/budget-planner.feature` (Phase-1
scenarios: Month Management, Income, Bills, Account Balances, Amendments Log, Dashboard calc).

## Resolved decisions (from clarification)

- **Backend tests use `pytest`**, not Vitest. The spec/CLAUDE.md "Vitest for Phase 1 calc" is a
  spec error — the calc lives in Python. Vitest is frontend-only (Phase 2). → log as a Spec Divergence.
- **`account_type` column added now** to `account_balances` (e.g. `"current" | "savings"`) so
  `total_savings` is computable. Minor divergence from the literal spec table — log it.
- **All writes are logged** (create / edit / delete) for bills, income, accounts — source `"user"` in Phase 1.
- Duplicate month → **HTTP 409**. Amounts/balances **≥ 0** (surplus may still be negative). `due_date` 1–31.
- Amendments are **append-only and never cascade-deleted**; `amendments.entity_id` is a plain
  integer (not an enforced FK) so deleting an entity preserves its audit trail.
- Account writes accept an **`active_month_id`** (defaults to latest month) to stamp the amendment's `month_id`.
- Carry-forward is a **preview endpoint + a single create POST with overrides** — no server-side session state.

## File structure (`backend/`)

```
backend/
├── main.py            # FastAPI app, router registration, lifespan→init_db, /api/health
├── config.py          # pydantic-settings BaseSettings (DATABASE_URL, APP_PIN) via python-dotenv
├── database.py        # engine (SQLite check_same_thread=False), SessionLocal, Base, get_db, init_db
├── models.py          # 5 SQLAlchemy ORM models
├── schemas.py         # Pydantic v2 Create/Update/Read + summary schemas
├── crud.py            # generic create/update/delete + amendment-logging helper (the seam Phase 3 reuses)
├── budget.py          # pure calc functions (no DB/FastAPI) — primary mutation target
├── carry_forward.py   # preview() + build_carried_items()
├── routers/{months,income,bills,accounts,amendments}.py
├── requirements.txt   # runtime + (dev) pytest, httpx, mutmut
└── tests/{conftest.py, factories.py, test_*.py}
```
Repo root: `MUTANTS.md` (new), `.gitignore` (data/, .env*), update `docs/progress-log.md`.

## Models (`models.py`) — match spec, +`account_type`

- **`budget_months`**: id PK; `month` String UNIQUE NOT NULL (regex `YYYY-MM` in Pydantic); notes;
  `created_at`/`updated_at` DateTime(tz) UTC defaults (`onupdate` for updated_at). Relations:
  income, bills `cascade="all, delete-orphan"`; amendments **no cascade**.
- **`income_entries`**: id; `month_id` FK→budget_months (indexed); label; `amount` Float; `is_recurring` Bool default False.
- **`bills`**: as income + `category` String NOT NULL; `due_date` Integer nullable (1–31).
- **`account_balances`** (NOT month-scoped, no FK): id; label; `balance` Float; `as_of_date` Date
  (default today); `account_type` String NOT NULL (`"current"|"savings"`); notes.
- **`amendments`** (append-only): id; `month_id` FK nullable (active month at edit time);
  `entity_type` `"bill"|"income"|"account_balance"`; `entity_id` plain Integer (NOT enforced FK);
  `field_changed`; `old_value`/`new_value` Text nullable; `reason` Text nullable (Claude-only, null now);
  `source` `"user"|"claude"` (always "user" in Phase 1); `amended_at` DateTime(tz) UTC.

Money = `Float` (REAL per CLAUDE.md); £ formatting is frontend's job. Timestamps stored UTC.

## Schemas (`schemas.py`, Pydantic v2)

Per entity: `Create` / `Update` / `Read` (`ConfigDict(from_attributes=True)`). Validators:
`amount`/`balance` `Field(ge=0)`; `month` regex; `due_date` `Field(ge=1, le=31)`;
`account_type`/`source`/`entity_type` as `Literal[...]`. Account write schemas carry optional
`active_month_id`. Aggregate schemas: `BudgetSummary` (total_income, total_bills, monthly_surplus,
total_balances, total_savings), `MonthDetail` (month + income + bills + summary),
`CarryForwardPreview`. Amendments are `Read`-only (written internally, never POSTed by clients).

## Endpoints (all under `/api`)

| Router | Routes |
|---|---|
| months | `GET/POST /months`, `GET/PATCH/DELETE /months/{id}`, `GET /months/{id}/summary`, `GET /months/{id}/detail`, `GET /months/carry-forward-preview?month=YYYY-MM` |
| income | `GET/POST /months/{id}/income`, `PATCH/DELETE /income/{id}` |
| bills  | `GET/POST /months/{id}/bills`, `PATCH/DELETE /bills/{id}` |
| accounts | `GET/POST /accounts`, `PATCH/DELETE /accounts/{id}` |
| amendments | `GET /months/{id}/amendments` (chronological, newest first) |
| health | `GET /api/health` |

`/summary` always recomputes fresh from DB via `budget.py` (CLAUDE.md: never stale). Item-level
edits/delete use flat paths (`/income/{id}`); the row already carries its `month_id`.

## Budget calc (`budget.py`)

Pure functions: `total_income(session, month_id)`, `total_bills(...)`,
`monthly_surplus = income − bills`, `total_balances(session)` (all accounts),
`total_savings(session)` (accounts where `account_type == "savings"`). No DB writes, no FastAPI —
unit-testable, mutation-tested. Use a small float epsilon (mockup uses `-0.001`) for surplus sign.

## Carry-forward (`carry_forward.py`)

"Most recent previous month" = `budget_months` where `month < target` (text sort valid for YYYY-MM),
ordered `month DESC`, first. Two-step API:
1. **Preview** (`GET /carry-forward-preview`) returns recurring income + recurring bills from that
   month as editable proposals (non-recurring excluded; empty if no previous month).
2. **Create** (`POST /months`) body `{month, notes?, carry_forward: bool, overrides: [{source_type, source_id, amount?, exclude?}]}`.
   `false` → blank month. `true` → copy recurring items as **new rows** (amounts as-is unless
   overridden; `exclude` drops them). Previous month never mutated; accounts never touched.

Maps every Month-Management scenario (first month, no-previous, recurring-only, amend-before-confirm,
skip, duplicate→409, accounts-not-carried). No "month created" amendment logged (no valid entity_type).

## Amendment logging (`crud.py`) — single reusable helper

Centralize to prevent drift. Generic ops mutate + log atomically in one transaction:
- `create_entity(...)` → Amendment `field_changed="created"`, old=None, new=serialized state.
- `update_entity(..., changes)` → one Amendment **per changed field** (`field_changed=field`, old/new
  stringified) — matches the per-field amendments-log screen.
- `delete_entity(...)` → Amendment `field_changed="deleted"`, old=serialized, new=None, then delete row.

`entity_type` ∈ {`"bill"`,`"income"`,`"account_balance"`}. `month_id` = entity's own for bills/income;
**caller-supplied active month** for accounts (default latest). `source` is a parameter (always
`"user"` now; Phase 3 passes `"claude"` + `reason` — zero rework). Routers stay thin: validate →
fetch (404) → delegate → return refreshed Read model.

## Tooling

`requirements.txt`: fastapi, uvicorn[standard], sqlalchemy>=2, pydantic>=2, pydantic-settings,
python-dotenv; dev: pytest, httpx, mutmut. Mutation testing via **mutmut** —
`paths_to_mutate = budget.py,carry_forward.py,crud.py`, `runner = python -m pytest -x -q`.
`MUTANTS.md` records any surviving mutant (id, file/line, what mutated, why acceptable) or states
a full kill. No undocumented survivors (CLAUDE.md).

## Build sequence (respects CLAUDE.md order)

1. **Scaffold** (no logic): config, database, main + `/api/health`, empty logic modules,
   requirements, `conftest.py`, pytest/mutmut config, `.gitignore`. Confirm pytest collects + app boots.
2. **Models + init_db** — 5 models, tables created.
3. **Budget calc** — failing `test_budget_calc.py` → `budget.py` → green → mutmut.
4. **Schemas** — all Create/Update/Read + summaries.
5. **CRUD + logging helper** — failing `test_amendment_logging.py` → `crud.py` → green → mutmut.
6. **Entity routers** (income, bills, accounts) — failing API tests (incl. 404/409/422) → thin routers → green.
7. **Amendments read router** — failing test → implement.
8. **Months router + carry-forward** — failing `test_carry_forward.py` + `test_months_api.py`
   → `carry_forward.py` + months router (preview/create/summary/detail) → green → mutmut.
9. **Full mutation pass** on budget/carry_forward/crud → write `MUTANTS.md`.
10. **Update `docs/progress-log.md`** (Phase 1 ✅, files/functions, Spec Divergences: Vitest→pytest,
    +account_type, all-writes-logged; intentional oddity: orphaned amendment `entity_id`; exact
    Phase-2 starting point). Commit logically-grouped changes on `claude/budget-planner-plan-M1oXO`
    (only when asked).

## Test ↔ Gherkin mapping

| Test file | Scenarios |
|---|---|
| test_budget_calc.py | Dashboard summary/consistency; bills-exceed-income (negative surplus); total_balances £22,700; total_savings |
| test_carry_forward.py | All Month-Management carry-forward scenarios |
| test_amendment_logging.py | Income/Bills/Accounts edit-logged; old+new stored; per-field; create/delete logging; account active month_id |
| test_months_api.py | create/list/get; duplicate→409; carry-forward POST variants; preview endpoint |
| test_income_api.py / test_bills_api.py / test_accounts_api.py | CRUD happy paths + 404/422; due_date; category grouping; multi-account total; not-month-scoped |
| test_amendments_api.py | Amendments visible per month; entry has source/field/old/new/reason/timestamp |

## Verification

- `cd backend && pytest` → all green (failing-first per slice).
- `cd backend && mutmut run && mutmut results` → no undocumented survivors; `MUTANTS.md` reflects state.
- `uvicorn main:app --reload --port 8000` boots; `GET /api/health` 200; OpenAPI docs at `/docs`
  list every endpoint. Spot-check via the auto docs / httpx: create month → add recurring bill+income
  → `GET /months/{id}/summary` returns correct surplus → create next month with carry-forward →
  confirm recurring-only copied and previous month unchanged → `GET /months/{id}/amendments` shows
  the logged writes.

## Out of scope (later phases)

Frontend/React (Phase 2), Claude chat + undo (Phase 3), Pi infra (Phase 0), backup cron/SSH (Phase 4),
PIN/hardening (Phase 5). The `crud.py` `source`/`reason` parameters and the `claude.py` router slot are
left as clean seams for Phase 3.
