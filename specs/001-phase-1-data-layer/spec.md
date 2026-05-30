# Feature Specification: Phase 1 — Budget Data Layer

**Feature Branch**: `claude/budget-planner-plan-M1oXO` (Spec Kit per-feature branching disabled to respect the project's single-branch rule)
**Created**: 2026-05-30
**Status**: Draft
**Input**: `docs/budget-planner-spec.md` (Phase 1), `docs/budget-planner.feature`

> Describes WHAT and WHY only — implementation detail lives in `plan.md`. Scoped to the
> backend data layer; UI, Claude integration, Pi infra, and backup are out of scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage a monthly budget (Priority: P1)

As a family member, I can create a budget month and record income and bills against it, so the
system can tell me what surplus is left after the bills are paid.

**Why this priority**: Without months + income + bills + the surplus calculation there is no
product. Everything else builds on this.

**Independent Test**: Create a month via the API, add income and bills, and read the summary —
the returned `monthly_surplus` equals income minus bills. Fully testable with no other story.

**Acceptance Scenarios**:

1. **Given** no months exist, **When** I create the first month, **Then** a blank month is
   returned with all figures (income, bills, surplus) zero.
2. **Given** a month exists, **When** I add/edit/delete an income entry or bill, **Then**
   totals and surplus recompute accordingly.
3. **Given** income £3,000 and bills £3,100, **When** I read the summary, **Then** surplus is
   −£100 (surplus may be negative).
4. **Given** a bill, **When** I add it, **Then** it may carry a category and an optional due date.

---

### User Story 2 - Carry forward recurring items (Priority: P2)

As a family member creating next month, I am offered last month's recurring income and bills
(amounts pre-filled, editable), so I don't re-enter them; one-offs are not carried.

**Why this priority**: Removes the biggest repetitive data-entry cost each month; depends on US1.

**Independent Test**: With a previous month containing recurring + non-recurring items, preview
carry-forward and create the next month — only recurring items appear, with override applied.

**Acceptance Scenarios**:

1. **Given** a previous month with recurring and non-recurring items, **When** I preview
   carry-forward, **Then** only recurring income and bills are offered with last month's amounts.
2. **Given** the preview, **When** I override an amount or exclude an item then create the
   month, **Then** the new month reflects my changes and the previous month is unchanged.
3. **Given** the carry-forward prompt, **When** I skip, **Then** a blank month is created.
4. **Given** account balances exist, **When** I create a month, **Then** balances are not carried.
5. **Given** a month already exists for `YYYY-MM`, **When** I create it again, **Then** a
   conflict is returned and no duplicate is created.

---

### User Story 3 - Track real account balances (Priority: P2)

As a family member, I record actual account balances (current and savings) with an as-of date,
independent of any month, so Claude can later reason against real money.

**Why this priority**: The real-money awareness layer; needed before Claude (Phase 3) but
independent of months.

**Independent Test**: Add several accounts of differing types and read the accounts list —
total across all accounts and the savings subtotal are correct, regardless of month.

**Acceptance Scenarios**:

1. **Given** three accounts (£2,300, £8,400, £12,000), **When** I list accounts, **Then** the
   total is £22,700.
2. **Given** accounts with `account_type` of current and savings, **When** I read summaries,
   **Then** `total_savings` reflects only savings/investment accounts.
3. **Given** accounts exist, **When** I switch the viewed month, **Then** accounts are unchanged
   and not duplicated per month.
4. **Given** a balance recorded >30 days ago, **When** I read it, **Then** its as-of date is
   available to flag staleness.

---

### User Story 4 - Audit every change (Priority: P3)

As a family member, every create/edit/delete is recorded in an append-only amendments log with
old/new values, the field changed, source, and timestamp, so changes are traceable.

**Why this priority**: Compliance/trust layer; valuable but the budget functions without it.

**Independent Test**: Edit a bill amount, then read the month's amendments — one entry exists
with `source="user"`, the field, and both old and new values.

**Acceptance Scenarios**:

1. **Given** I create/edit/delete an income, bill, or account, **Then** an amendment is logged
   with `source="user"`, `field_changed`, `old_value`, `new_value`, and a timestamp.
2. **Given** an account-balance change, **Then** the amendment records the active month at the
   time of the change.
3. **Given** an entity is deleted, **Then** its amendment history is preserved (never deleted).
4. **Given** a month with history, **When** I read its amendments, **Then** I get a chronological
   list with all fields.

### Edge Cases

- Negative income/bill/balance amounts are rejected; surplus itself may be negative.
- Creating a duplicate month returns a conflict, not a second month.
- Editing/deleting a non-existent entity returns not-found.
- Carry-forward with no previous month yields a blank month with no prompt.
- `due_date` outside 1–31 is rejected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist budget months (unique `YYYY-MM`), income entries, bills,
  account balances, and amendments.
- **FR-002**: System MUST compute `total_income`, `total_bills`, `monthly_surplus`,
  `total_balances`, and `total_savings` fresh from stored data on request.
- **FR-003**: System MUST support create/read/update/delete for income, bills, and accounts,
  and read for months and amendments.
- **FR-004**: System MUST offer carry-forward of recurring income and bills only, with per-item
  amount override and exclusion, without mutating the previous month or touching accounts.
- **FR-005**: System MUST reject a duplicate month, invalid amounts (<0), and out-of-range due
  dates (outside 1–31).
- **FR-006**: System MUST log every create/edit/delete to an append-only amendments record with
  `source`, `field_changed`, `old_value`, `new_value`, and timestamp; amendments are never deleted.
- **FR-007**: Account balances MUST NOT be month-scoped and MUST distinguish savings from
  current accounts (`account_type`).

### Key Entities

- **BudgetMonth** — month container (`YYYY-MM`, notes, created/updated timestamps).
- **IncomeEntry** — label, amount, recurring flag; belongs to a month.
- **Bill** — label, amount, category, recurring flag, optional due date; belongs to a month.
- **AccountBalance** — label, balance, as-of date, account type, notes; not month-scoped.
- **Amendment** — append-only audit row (entity type/id, field, old/new, reason, source, month, time).

## Success Criteria *(mandatory)*

- **SC-001**: All Phase-1 Gherkin scenarios (Month Management, Income, Bills, Account Balances,
  Amendments Log, Dashboard calc) pass as automated tests.
- **SC-002**: Budget figures are mathematically consistent and recomputed from stored data on
  every read.
- **SC-003**: No undocumented surviving mutants in calculation, carry-forward, or logging code.

## Out of Scope

Frontend UI, Claude integration + undo, Pi infrastructure, backup automation, PIN/auth.
