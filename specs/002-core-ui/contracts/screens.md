# Contract — Screens, Navigation & Read-Only Behaviour

Reproduces `docs/mockup/` (the visual + interaction source of truth). Each screen lists the data it
reads, the writes it triggers (each followed by a `refetch()`), and its read-only behaviour. Maps
to the Gherkin in `docs/budget-planner.feature` and the spec's user stories.

## Navigation

- **Bottom tab bar** (persistent on primary screens): Dashboard · Bills · Accounts · Claude.
- **Sub-screens** (no tab; back to dashboard): Income, Amendments, Months, Create-month.
- **Active vs editable month**: app tracks `activeMonthId` (the month being viewed) and the
  `editableMonthId` (latest month). `readOnly = activeMonthId !== editableMonthId`.
- The Create-month screen hides the tab bar (full-screen flow), matching the prototype.

## Screens

### Dashboard (`screens/Dashboard.tsx`) — US1
- **Reads**: `monthDetail(activeMonthId)` (summary + income count), `listAccounts()`.
- **Renders**: navy hero (month switcher, monthly-surplus figure, status pill, bills-of-income
  bar; hero turns red on negative surplus); receipt card (income − bills = surplus); accounts-total
  card with stale count; "Ask Claude" card (→ placeholder); Manage list (Income, Amendments, Months).
- **Read-only**: shows a read-only banner when viewing a past month.
- **Empty**: when `listMonths()` is empty → `EmptyState` (create-first-month prompt; no figures).

### Income (`screens/Income.tsx`) — US2
- **Reads**: income + `total_income` from `monthDetail(activeMonthId)`.
- **Writes**: `createIncome` / `updateIncome` / `deleteIncome` via the item Sheet → `refetch()`.
- **Read-only**: add button + row taps disabled; banner shown.

### Bills (`screens/Bills.tsx`) — US3
- **Reads**: bills + `total_bills`/`monthly_surplus` from `monthDetail`.
- **Renders**: over-budget banner when `total_bills > total_income`; category groups with colour
  dot + subtotal; due-date label; bills sorted by due date within category.
- **Writes**: `createBill` / `updateBill` / `deleteBill` via Sheet (category chips + free-text;
  optional due day) → `refetch()`.
- **Read-only**: as Income.

### Accounts (`screens/Accounts.tsx`) — US4
- **Reads**: `listAccounts()` (accounts + `total_balances`).
- **Renders**: navy header total; per-account freshness dot (green/amber), "Updated N days ago",
  "Stale" pill at ≥30 days; header/banner stale count; empty state when no accounts.
- **Writes**: `createAccount` / `updateAccount` / `deleteAccount` via Sheet (label + balance;
  saves as-of today; passes `active_month_id = editableMonthId`) → `refetch()`.
- **Not month-scoped**: identical regardless of `activeMonthId`, and **remains editable** even when a
  past month is the active view — accounts are global, so the read-only rule applies only to
  month-scoped screens.

### Months + Create-month (`screens/MonthManagement.tsx`) — US5
- **Months list reads**: `listMonths()`; per-month summary for the income/surplus mini-figures;
  "Current" badge on the editable (latest) month, lock icon on others.
- **Switch**: tapping a month sets `activeMonthId` and returns to Dashboard.
- **Create reads**: `carryForwardPreview(newMonth)` → recurring income & bills pre-filled.
- **Create interactions**: per-row amend amount / exclude (untick); live **projected surplus**
  (client-computed preview); skip → blank month.
- **Create write**: `createMonth({ month, carry_forward: true, overrides })` (or
  `carry_forward: false` when skipped) → on 201 switch to the new month; `409` → "month already
  exists" inline.

### Amendments (`screens/Amendments.tsx`) — US6
- **Reads**: `listAmendments(activeMonthId)` (newest first).
- **Renders**: source chip (You / Claude), verb (Created/Updated/Removed) + target + label,
  from→to for updates (parsed money), reason, local-time timestamp.

### Claude (`screens/Claude.tsx`) — placeholder
- Inert "Coming in Phase 3" screen. No API call, no input wired. Reached from tab + dashboard card.

### EmptyState (`screens/EmptyState.tsx`)
- Shown when no months exist; single CTA → Create-month.

## Cross-cutting contract
- **Freshness after writes**: every successful write awaits then `refetch()`s affected data
  (constitution V / FR-009) — no optimistic stale arithmetic (except the create-month projected
  preview, which persists nothing).
- **Formatting**: `£X,XXX.XX`; negatives red + leading minus; timestamps local time.
- **Validation/errors**: client blocks invalid input pre-submit; mapped `422/404/409` and failed
  loads render recoverable inline error states.
- **Read-only**: a past `activeMonthId` hides/disables add/edit/delete affordances on the
  month-scoped screens (Dashboard, Income, Bills, Amendments) and shows the read-only banner;
  returning to the editable month restores them. **Accounts are exempt** (global, not month-scoped)
  and stay editable throughout.
