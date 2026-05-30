---
description: "Task list for Phase 1 — Budget Data Layer"
---

# Tasks: Phase 1 — Budget Data Layer

**Input**: Design documents from `/specs/001-phase-1-data-layer/` (+ engineering detail in `/phase-1.md`)
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Included — the constitution mandates TDD (tests written before implementation).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 / US4, or SETUP / FOUND / POLISH

## Phase 1: Setup (shared foundation)

- [X] T001 [SETUP] Create `backend/pyproject.toml` (runtime deps + `[project.optional-dependencies] dev`: pytest, httpx, mutmut, ruff). `.gitignore` already provided by Spec Kit init.
- [X] T002 [SETUP] Scaffold `backend/config.py`, `backend/database.py` (engine/SessionLocal/Base/get_db/init_db), `backend/main.py` + `/api/health`.
- [X] T003 [P] [SETUP] Add `backend/tests/conftest.py` (in-memory SQLite engine, `db_session`, `TestClient` with `get_db` override) and `backend/tests/factories.py`.
- [X] T004 [SETUP] Configure mutmut in `pyproject.toml` (`paths_to_mutate = budget.py,carry_forward.py,crud.py`); confirm `pytest` collects and the app boots.

## Phase 2: Foundational (blocks all user stories)

- [X] T005 [FOUND] Define the 5 SQLAlchemy models in `backend/models.py` (per `/phase-1.md`); `init_db` creates tables.
- [X] T006 [P] [FOUND] Define Pydantic Create/Update/Read + `BudgetSummary`/`MonthDetail`/`CarryForwardPreview` in `backend/schemas.py`.

## Phase 3: User Story 1 — Manage a monthly budget (P1) 🎯 MVP

- [X] T007 [P] [US1] Write failing `backend/tests/test_budget_calc.py` (income/bills/surplus, negative surplus, empty month, `total_balances` and `total_savings` over mixed account types).
- [X] T008 [US1] Implement all pure calc functions in `backend/budget.py` (`total_income`, `total_bills`, `monthly_surplus`, `total_balances`, `total_savings`) → tests green. Note: `total_balances`/`total_savings` are pure sums over the accounts table and live here so the US1 `/summary` endpoint (T011) has no forward dependency on US3.
- [X] T009 [US1] Write failing `backend/tests/test_amendment_logging.py`; implement `backend/crud.py` create/update/delete + logging helper → green.
- [X] T010 [US1] Write failing `backend/tests/test_income_api.py` + `test_bills_api.py`; implement `routers/income.py`, `routers/bills.py` (CRUD; 404 on missing id; 422 on negative `amount` and on `due_date` outside 1–31 per FR-005) → green.
- [X] T011 [US1] Implement `routers/months.py` GET/POST/PATCH + `/summary` + `/detail`; write failing `backend/tests/test_months_api.py` first → green.
- **Checkpoint**: months + income + bills + surplus fully working and independently testable.

## Phase 4: User Story 2 — Carry forward recurring items (P2)

- [X] T012 [P] [US2] Write failing `backend/tests/test_carry_forward.py` (recurring-only, override, skip, no-previous, duplicate→409, accounts untouched, prev month unchanged).
- [X] T013 [US2] Implement `backend/carry_forward.py` (preview + build) and wire `carry-forward-preview` + create-with-overrides into `routers/months.py` → green.

## Phase 5: User Story 3 — Track real account balances (P2)

- [X] T014 [P] [US3] Write failing `backend/tests/test_accounts_api.py` (CRUD, multi-account total, savings subtotal, not month-scoped, `active_month_id` on amendments).
- [X] T015 [US3] Implement `routers/accounts.py` (CRUD; `total_balances`/`total_savings` already in `budget.py` from T008) → green.

## Phase 6: User Story 4 — Audit every change (P3)

- [X] T016 [US4] Write failing `backend/tests/test_amendments_api.py` (per-month chronological list, full fields); implement `routers/amendments.py` (read-only) → green.

## Phase 7: Polish & gates

- [X] T017 [POLISH] Run `ruff check .` + `ruff format .`; fix all findings.
- [X] T018 [POLISH] Run `mutmut run`; kill or document survivors in `MUTANTS.md`.
- [X] T019 [POLISH] Confirm full `pytest` green; update `docs/progress-log.md` (Phase 1 ✅, files/functions, spec divergences: Vitest→pytest, +account_type, all-writes-logged; intentional oddity: orphaned amendment `entity_id`; Phase-2 starting point).

## Dependencies

- Setup (T001–T004) → Foundational (T005–T006) → Stories (US1–US4).
- US1 (T007–T011) is the MVP and independently shippable.
- US2, US3, US4 depend only on Foundational (+ US1's months for month-scoped amendments) and
  otherwise proceed in priority order. (`total_balances`/`total_savings` are implemented in T008
  so US1's `/summary` has no forward dependency on US3.)
- Polish (T017–T019) last.

## Parallel Example

After T006, the test-authoring tasks T007 (calc), T012 (carry-forward), and T014 (accounts) can
be drafted in parallel — they touch different test files.
