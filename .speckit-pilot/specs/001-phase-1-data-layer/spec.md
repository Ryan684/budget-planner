# Feature Specification: Phase 1 — Budget Data Layer

**Feature Branch:** `speckit-pilot-phase-1`
**Created:** 2026-05-30
**Status:** Draft (pilot)
**Input:** `docs/budget-planner-spec.md` (Phase 1), `docs/budget-planner.feature`

> Spec Kit pilot artifact. Describes WHAT and WHY only — no tech/implementation detail
> (that lives in `plan.md`). Scoped to the backend data layer; UI, Claude, infra are out of scope.

## User Scenarios & Testing

### User Story 1 — Manage a monthly budget (Priority: P1)
As a family member, I can create a budget month and record income and bills against it, so
the system can tell me what surplus is left after the bills are paid.

**Why this priority:** Without months + income + bills + the surplus calculation there is no
product. Everything else builds on it.

**Acceptance (from feature file):**
1. Creating the first month yields a blank month with all figures zero.
2. Adding/editing/deleting income or bills updates totals and surplus immediately.
3. `monthly_surplus = total_income − total_bills`; surplus may be negative.
4. Bills carry an optional category and due date.

### User Story 2 — Carry forward recurring items (Priority: P2)
As a family member creating next month, I am offered last month's recurring income and
bills (amounts pre-filled, editable), so I don't re-enter them; one-offs are not carried.

**Acceptance:** recurring-only carry-forward; amounts copied as-is but amendable before
confirm; skip option yields a blank month; account balances are never carried forward;
the previous month is never mutated; a duplicate month is rejected.

### User Story 3 — Track real account balances (Priority: P2)
As a family member, I record actual account balances (current and savings) with an as-of
date, independent of any month, so Claude can later reason against real money.

**Acceptance:** accounts are not month-scoped; total across accounts is available; savings
subtotal is distinguishable from current accounts; stale balances (>30 days) are detectable.

### User Story 4 — Audit every change (Priority: P3)
As a family member, every create/edit/delete is recorded in an append-only amendments log
with old/new values, the field changed, source, and timestamp, so changes are traceable.

**Acceptance:** user actions log `source="user"`; amendments are queryable per month;
account-balance amendments record the active month at the time of the change; amendments
are never deleted even when the underlying entity is removed.

### Edge Cases
- Negative income/bill amounts are rejected; surplus itself may be negative.
- Creating a duplicate month returns a conflict, not a second month.
- Editing/deleting a non-existent entity returns not-found.
- Carry-forward with no previous month yields a blank month with no prompt.

## Requirements

### Functional
- **FR-001** System MUST persist budget months (unique `YYYY-MM`), income entries, bills,
  account balances, and amendments.
- **FR-002** System MUST compute `total_income`, `total_bills`, `monthly_surplus`,
  `total_balances`, and `total_savings` fresh from stored data on request.
- **FR-003** System MUST support create/read/update/delete for income, bills, and accounts,
  and read for months and amendments.
- **FR-004** System MUST offer carry-forward of recurring income and bills only, with
  per-item amount override and exclusion, without mutating the previous month.
- **FR-005** System MUST reject a duplicate month and invalid amounts (<0) / due dates
  (outside 1–31).
- **FR-006** System MUST log every create/edit/delete to an append-only amendments record
  with `source`, `field_changed`, `old_value`, `new_value`, and timestamp.
- **FR-007** Account balances MUST NOT be month-scoped and MUST distinguish savings from
  current accounts.

### Key Entities
- **BudgetMonth** — a month container (`YYYY-MM`, notes, timestamps).
- **IncomeEntry** — label, amount, recurring flag; belongs to a month.
- **Bill** — label, amount, category, recurring flag, optional due date; belongs to a month.
- **AccountBalance** — label, balance, as-of date, account type, notes; not month-scoped.
- **Amendment** — append-only audit row (entity type/id, field, old/new, reason, source, month, time).

## Success Criteria
- **SC-001** All Phase-1 Gherkin scenarios (Month Management, Income, Bills, Account
  Balances, Amendments Log, Dashboard calc) pass as automated tests.
- **SC-002** Budget figures are mathematically consistent and recomputed from stored data.
- **SC-003** No undocumented surviving mutants in calculation/carry-forward/logging code.

## Out of Scope
Frontend UI, Claude integration + undo, Pi infrastructure, backup automation, PIN/auth.
