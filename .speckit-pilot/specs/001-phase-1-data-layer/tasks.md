# Tasks: Phase 1 — Budget Data Layer

**Spec:** `./spec.md` | **Plan:** `./plan.md` | **Engineering detail:** `/phase-1.md`
`[P]` = parallelizable (different files, no ordering dependency). TDD: tests before code.

## Phase A: Setup (shared foundation)
- [ ] T001 Create `backend/pyproject.toml` (deps + dev group: pytest, httpx, mutmut, ruff) and `.gitignore` (data/, .env*).
- [ ] T002 Scaffold `backend/config.py`, `database.py` (engine/SessionLocal/Base/get_db/init_db), `main.py` + `/api/health`.
- [ ] T003 [P] Add `backend/tests/conftest.py` (in-memory SQLite engine, db_session, TestClient with get_db override) and `factories.py`.
- [ ] T004 Configure mutmut (`paths_to_mutate = budget.py,carry_forward.py,crud.py`) and confirm `pytest` collects + app boots.

## Phase B: Foundational (blocks all stories)
- [ ] T005 Define the 5 SQLAlchemy models in `backend/models.py` (per `/phase-1.md`), `init_db` creates tables.
- [ ] T006 [P] Define Pydantic Create/Update/Read + `BudgetSummary`/`MonthDetail`/`CarryForwardPreview` in `backend/schemas.py`.

## Phase C: User Story 1 — Manage a monthly budget (P1) 🎯 MVP
- [ ] T007 [P] Write failing `tests/test_budget_calc.py` (income/bills/surplus, negative surplus, empty month).
- [ ] T008 Implement pure functions in `backend/budget.py` → tests green.
- [ ] T009 Write failing `tests/test_amendment_logging.py`, then implement `backend/crud.py` create/update/delete + logging helper → green.
- [ ] T010 Write failing `tests/test_income_api.py` + `test_bills_api.py`, then implement `routers/income.py`, `routers/bills.py` (CRUD + 404/422) → green.
- [ ] T011 Implement `routers/months.py` GET/POST/PATCH + `/summary` + `/detail`; failing `tests/test_months_api.py` first → green.
- [ ] **Checkpoint:** months + income + bills + surplus fully working and tested.

## Phase D: User Story 2 — Carry forward recurring items (P2)
- [ ] T012 [P] Write failing `tests/test_carry_forward.py` (recurring-only, override, skip, no-previous, duplicate→409, accounts untouched, prev month unchanged).
- [ ] T013 Implement `backend/carry_forward.py` (preview + build) and wire `carry-forward-preview` + create-with-overrides into `routers/months.py` → green.

## Phase E: User Story 3 — Track real account balances (P2)
- [ ] T014 Write failing `tests/test_accounts_api.py` (CRUD, multi-account total, savings subtotal, not month-scoped, active_month_id on amendments).
- [ ] T015 Implement `routers/accounts.py` + `total_savings`/`total_balances` in `budget.py` → green.

## Phase F: User Story 4 — Audit every change (P3)
- [ ] T016 Write failing `tests/test_amendments_api.py` (per-month chronological list, full fields), then implement `routers/amendments.py` (read-only) → green.

## Phase G: Polish & gates
- [ ] T017 Run `ruff check .` + `ruff format .`; fix all findings.
- [ ] T018 Run `mutmut run`; kill or document survivors in `MUTANTS.md`.
- [ ] T019 Confirm full `pytest` green; update `docs/progress-log.md` (Phase 1 ✅, files/functions, spec divergences, Phase-2 starting point).

## Dependencies
- Setup (A) → Foundational (B) → Stories (C–F). C is the MVP and is independently shippable.
- D, E, F each depend only on B (+ C's months for month-scoped amendments) and can otherwise proceed in priority order.
- Polish (G) last.

## Parallel example
After T006, T007 (calc tests) and T012 (carry-forward tests) and T014 (accounts tests) can be drafted in parallel — different files.
