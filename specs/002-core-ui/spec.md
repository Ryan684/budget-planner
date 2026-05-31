# Feature Specification: Phase 2 — Core UI

**Feature Branch**: `002-core-ui` (Spec Kit branch-per-feature model; merged to `main` via PR when quality gates pass)
**Created**: 2026-05-31
**Status**: Draft
**Input**: `docs/budget-planner-spec.md` (Phase 2 — Core UI), `docs/budget-planner.feature`,
`docs/mockup/` (Claude Designer prototype — visual + interaction source of truth)

> Describes WHAT and WHY only — implementation detail lives in `plan.md`. Scoped to the
> mobile-first frontend that makes the Phase 1 data layer usable from a phone browser.
> Claude integration + undo, backup automation, and PIN/auth are out of scope.
>
> **Design reference**: `docs/mockup/` is a working Claude Designer prototype (screens, shared
> components, design tokens, and sample data) and is the **visual and interaction source of truth**
> for this phase. The build must reproduce its layout, navigation, and component language. The key
> structures it fixes are:
> - **Bottom tab bar** with four tabs — Dashboard, Bills, Accounts, Claude — on a navy chrome;
>   Income, Amendments, Months, and Create-month are sub-screens reached from the dashboard
>   "Manage" list and the month switcher.
> - **Dashboard hero** (navy, turns red on negative surplus): month switcher, large surplus
>   figure, a status pill, and a "bills-of-income" progress bar; below it a receipt-style
>   `income − bills = surplus` card, an accounts-total card (with stale warning), an "Ask Claude"
>   card, and a Manage list (Income, Amendments log, Months).
> - **Add/edit via bottom sheets** (label, amount, recurring toggle, category for bills, optional
>   due day) with a delete action when editing — not separate pages.
> - **Design tokens**: navy brand ramp, IBM Plex Sans / IBM Plex Mono (figures), semantic
>   green/amber/red tones, 14px card radius; account freshness shown as a green/amber dot, an
>   "Updated N days ago" label, and a "Stale" pill at ≥30 days.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the budget at a glance (Priority: P1)

As a family member opening the app on my phone, I see the current month's total income, total
bills, monthly surplus, and the combined account balance on one dashboard, so I instantly know
where we stand without doing any maths.

**Why this priority**: The dashboard is the headline screen and the first thing seen on every
visit. It delivers the core value — "what's our surplus?" — and is the hub the other screens
hang off. A viable UI MVP can ship with just this view against real data.

**Independent Test**: With a month containing income and bills and several account balances
present in the data layer, open the app — the dashboard shows the correct income, bills, surplus,
and total-balances figures, formatted in GBP, with no manual calculation required.

**Acceptance Scenarios**:

1. **Given** income and bills are set for the current month, **When** I view the dashboard,
   **Then** the hero shows the monthly surplus and a status pill, the receipt card shows total
   income, fixed bills, and surplus, and all figures are mathematically consistent.
2. **Given** account balances exist, **When** I view the dashboard, **Then** the accounts card
   shows the total across all accounts (with a stale warning if any balance is ≥30 days old) and
   tapping it navigates to the full accounts screen.
3. **Given** a negative surplus, **When** I view the dashboard, **Then** the surplus is shown in
   red with a leading minus sign (never parentheses) and the hero adopts its negative treatment.
4. **Given** the app shell, **When** I view any primary screen, **Then** a bottom tab bar offers
   Dashboard, Bills, Accounts, and Claude, and the dashboard Manage list links to Income, the
   Amendments log, and Months.
5. **Given** no months exist, **When** I open the app for the first time, **Then** I see the empty
   state prompting me to create my first month, with no figures or errors shown.
6. **Given** a change was made on another screen, **When** I return to the dashboard, **Then** the
   figures reflect the latest state fetched fresh from the data layer.

---

### User Story 2 - Manage income entries (Priority: P1)

As a family member, I can view, add, edit, and delete income entries for the current month and
mark each as recurring, so the surplus reflects what we actually bring in.

**Why this priority**: Income is one half of the core surplus equation; without editing it from
the phone the app cannot replace the spreadsheet.

**Independent Test**: On the income screen for the current month, add a £500 entry — it appears
in the list and total income increases by £500; edit and delete it and totals update each time.

**Acceptance Scenarios**:

1. **Given** the income screen, **When** I tap add and complete the bottom sheet (e.g. "Freelance",
   £500, non-recurring), **Then** it appears in the list and total income and surplus update.
2. **Given** the income screen, **When** I add a recurring entry, **Then** it is flagged as
   recurring in the list.
3. **Given** an existing entry, **When** I edit its amount, **Then** the list, total income, and
   surplus update immediately and the change is recorded as a user amendment.
4. **Given** an existing entry, **When** I delete it, **Then** it is removed and totals update.
5. **Given** two entries totalling £4,000, **When** I add a third for £200, **Then** total income
   shows £4,200 immediately.
6. **Given** the income form, **When** I submit a negative amount, **Then** the entry is rejected
   with a clear message and nothing is created.

---

### User Story 3 - Manage bills grouped by category (Priority: P1)

As a family member, I can view, add, edit, and delete bills grouped by category with subtotals,
set each bill recurring with an optional due date, and be warned when bills exceed income, so I
can see exactly where the money goes and whether we are overspending.

**Why this priority**: Bills are the other half of the surplus equation and the richest editing
surface (categories, due dates, over-budget warning). Core to replacing the spreadsheet.

**Independent Test**: On the bills screen, add bills in two categories — they appear grouped with
correct per-category subtotals; raise bills above income and the over-budget warning appears.

**Acceptance Scenarios**:

1. **Given** the bills screen, **When** I tap add and complete the bottom sheet (e.g. "Mortgage",
   £1,100, "Housing", recurring), **Then** it appears under its category and totals update.
2. **Given** bills across multiple categories, **When** I view the screen, **Then** bills are
   visually grouped by category (with a colour dot) and each category shows a subtotal.
3. **Given** the bill sheet, **When** I set a category, **Then** I can pick a suggested category
   (Housing, Utilities, Childcare, Transport, Insurance, One-off) or type my own free-text value.
4. **Given** total income £3,000, **When** total bills reach £3,100, **Then** a visible warning
   banner is shown and surplus displays as negative (red, minus sign).
5. **Given** a bill with a due date, **When** I view the screen, **Then** the due date is shown
   and bills with due dates are sorted by due date within their category.
6. **Given** an existing bill, **When** I open its sheet to edit or delete it, **Then** the list
   and totals update immediately and edits are recorded as user amendments.
7. **Given** the bill sheet, **When** I submit a negative amount or a due day outside 1–31,
   **Then** the bill is rejected with a clear message and nothing is created.

---

### User Story 4 - Track real account balances (Priority: P2)

As a family member, I can view, add, edit, and delete account balances with an as-of date and see
the total across all accounts, with stale balances flagged, so the recorded figures reflect real
money and I know when they were last checked.

**Why this priority**: The real-money awareness layer. Valuable on its own and needed before
Claude (Phase 3), but the surplus model functions without it.

**Independent Test**: Add three accounts (£2,300, £8,400, £12,000) — all appear and the total
shows £22,700; a balance dated more than 30 days ago shows a stale indicator.

**Acceptance Scenarios**:

1. **Given** the accounts screen, **When** I add an account via its sheet (saving records the
   balance as of today), **Then** it appears and the total across all accounts updates immediately.
2. **Given** three accounts (£2,300, £8,400, £12,000), **When** I view the screen, **Then** the
   navy header total shows £22,700.
3. **Given** an existing account, **When** I edit its balance, **Then** the as-of date moves to
   today, the new balance and an "Updated …" label are shown, and a user amendment is recorded.
4. **Given** an account, **When** I delete it from its sheet, **Then** it is removed and the total
   updates.
5. **Given** a balance recorded more than 30 days ago, **When** I view the screen, **Then** the
   account shows an amber freshness dot and a "Stale" pill, a header/banner stale count appears,
   and the as-of date is shown clearly.
6. **Given** accounts exist, **When** I switch to view a previous month, **Then** the accounts
   screen still shows the same current balances, not duplicated or historicised per month.

---

### User Story 5 - Create and switch months with carry-forward (Priority: P2)

As a family member, I can create a new month — being offered last month's recurring income and
bills with editable amounts — and navigate between months, viewing previous months read-only, so
setting up each month is quick and history stays intact.

**Why this priority**: Carry-forward removes the biggest monthly data-entry cost and month
navigation frames every other screen, but a single current month is usable without it.

**Independent Test**: With a previous month containing recurring and non-recurring items, start a
new month — only recurring items are offered with last month's amounts; override one and confirm,
and the new month reflects the override while the previous month is unchanged.

**Acceptance Scenarios**:

1. **Given** no previous month, **When** I create a month, **Then** I am not prompted to carry
   anything and a blank month is created.
2. **Given** a previous month with recurring and non-recurring items, **When** I create a month,
   **Then** I am prompted to carry forward recurring income and bills only, pre-filled with last
   month's amounts; non-recurring items are not offered.
3. **Given** the carry-forward prompt, **When** I change a carried amount and confirm, **Then**
   the new month uses my amended amount and the previous month is unchanged.
4. **Given** the carry-forward prompt, **When** I skip, **Then** a blank month is created with
   nothing pre-populated.
5. **Given** a month already exists for a period, **When** I attempt to create it again, **Then**
   I see an error that the month exists and no duplicate is created.
6. **Given** the carry-forward screen, **When** I review it, **Then** a projected-surplus figure
   updates as I amend or exclude items before I confirm.
7. **Given** multiple months, **When** I move between months via the dashboard hero switcher or
   the Months list, **Then** a previous month shows a read-only banner and exposes no active
   add/edit/delete controls; **When** I return to the current month, **Then** editing is restored.

---

### User Story 6 - Review the amendments log (Priority: P3)

As a family member, I can open the amendments log for the viewed month and see a chronological
list of every change with its source, field changed, old and new values, reason, and timestamp,
so changes are traceable.

**Why this priority**: Trust and traceability layer. The budget functions without viewing the log,
so it is the lowest priority of the Phase 2 screens.

**Independent Test**: After editing a bill amount, open the amendments log for the month — one
entry shows source "user", the field changed, and both old and new values with a timestamp.

**Acceptance Scenarios**:

1. **Given** a month with a history of changes, **When** I open its amendments log, **Then** I see
   a chronological list and each entry shows source, field changed, old value, new value, reason,
   and timestamp (displayed in local time).
2. **Given** a manual bill edit, **When** I view the log, **Then** the entry shows source "user"
   with both old and new values.
3. **Given** a created or deleted entry, **When** I view the log, **Then** the entry shows the
   field changed as "created" or "deleted" respectively.

### Edge Cases

- **No data yet**: empty dashboard shows a create-first-month prompt; income/bills/accounts lists
  show friendly empty states rather than blank screens or errors.
- **Negative surplus**: shown in red with a minus sign on both the dashboard and bills screen.
- **Invalid input**: negative amounts/balances and due dates outside 1–31 are blocked in the UI
  with a clear message; the entry is not created.
- **Previous month**: editing controls (the add button, row taps into sheets, add buttons) are
  hidden or disabled and a read-only banner is shown when a past month is in view.
- **Stale balance**: account balances ≥30 days old carry an amber dot, a "Stale" pill, and
  contribute to the stale count surfaced on the dashboard and accounts screens.
- **Claude entry point**: the Claude tab and the dashboard "Ask Claude" card are present but route
  to a "Coming in Phase 3" placeholder — no chat, context, write, or undo behaviour.
- **Data-layer error**: if a read or write to the data layer fails, the UI shows a recoverable
  error state rather than silently displaying stale or partial figures.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The UI MUST present a mobile-first dashboard showing total income, total bills,
  monthly surplus, and total account balances for the current month, with a link to the accounts
  screen and an entry point to each other screen.
- **FR-002**: The UI MUST let users add, edit, and delete income entries and bills for the current
  month via bottom sheets, including a recurring toggle, and for bills a category and an optional
  due day; the category field MUST offer the suggested set (Housing, Utilities, Childcare,
  Transport, Insurance, One-off) while still accepting a free-text value.
- **FR-003**: The UI MUST group bills by category with a subtotal per category and sort bills with
  due dates by due date within their category.
- **FR-004**: The UI MUST show a visible warning when total bills exceed total income and display
  negative figures in red with a leading minus sign (never parentheses).
- **FR-005**: The UI MUST let users add, edit, and delete account balances with an as-of date,
  show the total across all accounts, and flag balances older than 30 days as stale.
- **FR-006**: The UI MUST support creating a new month with a carry-forward prompt offering only
  recurring income and bills (amounts pre-filled and editable, items excludable), a skip option,
  and MUST prevent creating a duplicate month with a clear error.
- **FR-007**: The UI MUST let users navigate between months and render previous months as
  read-only (no add/edit/delete controls active), while keeping the current month editable.
- **FR-008**: The UI MUST display the amendments log for the viewed month as a chronological list
  showing source, field changed, old value, new value, reason, and timestamp.
- **FR-009**: After any write, the UI MUST refresh budget figures from the data layer rather than
  recomputing from stale client-side state, so all displayed totals stay consistent.
- **FR-010**: The UI MUST validate input before submitting — rejecting negative amounts/balances
  and due dates outside 1–31 — and surface a clear, user-friendly message on rejection.
- **FR-011**: All monetary figures MUST be formatted as GBP `£X,XXX.XX` (two decimal places) with
  negatives in red and a leading minus sign; all timestamps MUST be displayed in local time.
- **FR-012**: The UI MUST present friendly empty states (e.g. create-first-month prompt, empty
  accounts state) and recoverable error states when a data-layer read or write fails.
- **FR-013**: The UI MUST provide a persistent bottom tab bar (Dashboard, Bills, Accounts, Claude)
  on primary screens, with Income, Amendments, Months, and Create-month reachable as sub-screens
  from the dashboard Manage list and the month switcher, matching the mockup's navigation.
- **FR-014**: The UI's layout, components, and design language (navy chrome, dashboard hero with
  surplus + status pill + bills-of-income bar, receipt-style summary card, account freshness dots
  and "Stale" pill, bottom-sheet forms) MUST follow the `docs/mockup/` prototype.
- **FR-015**: The Claude tab and the dashboard "Ask Claude" card MUST be present but route to a
  placeholder indicating Claude arrives in Phase 3, with no chat, context injection, write, or
  undo behaviour implemented this phase.

### Key Entities

The UI consumes the Phase 1 data-layer entities; it does not introduce new persisted entities.
The user-facing views are:

- **App shell** — navy chrome with a bottom tab bar (Dashboard, Bills, Accounts, Claude).
- **Dashboard** — hero (month switcher, surplus, status pill, bills-of-income bar), receipt-style
  income/bills/surplus card, accounts-total card, "Ask Claude" card, and a Manage list.
- **Income list** — income entries for the viewed month (label, amount, recurring).
- **Bills list** — bills for the viewed month grouped by category (label, amount, category,
  recurring, optional due day), with per-category subtotals.
- **Accounts list** — account balances (label, balance, as-of date, freshness/stale indicator)
  and total; not month-scoped.
- **Edit/add bottom sheet** — the add/edit form for income, bills, and accounts, with delete.
- **Month switcher / Months list / Create-month** — month navigation and the carry-forward flow.
- **Amendments log** — chronological change history for the viewed month.
- **Claude placeholder** — tab + dashboard card indicating Phase 3 (no behaviour this phase).

## Success Criteria *(mandatory)*

- **SC-001**: Every Phase 2 Gherkin scenario in `docs/budget-planner.feature` (Dashboard, Income,
  Bills, Account Balances, and the UI-facing Month Management scenarios) passes as an automated
  frontend test.
- **SC-002**: Displayed totals (income, bills, surplus, account total, category subtotals) match
  the figures returned by the data layer for the same data in 100% of cases, and refresh after
  every write.
- **SC-003**: A family member can open the app and read the current month's surplus within 5
  seconds of load on a phone browser, with no horizontal scrolling required in portrait.
- **SC-004**: A family member can add an income entry or bill from a phone in under 30 seconds,
  and the affected totals reflect the change without a manual page reload.
- **SC-005**: All monetary figures render as `£X,XXX.XX` and negative figures appear in red with a
  minus sign across every screen; previous-month views expose no active edit controls.
- **SC-006**: The implemented screens match the `docs/mockup/` prototype in layout, navigation
  (bottom tab bar + sub-screens), and component language, as confirmed by side-by-side review.

## Assumptions

- **Built on Phase 1 API**: Phase 2 is a frontend layer over the existing Phase 1 data-layer
  endpoints and introduces no new backend behaviour. If a screen needs data the API does not yet
  expose, that gap is raised explicitly during planning rather than silently adding backend scope.
- **Mockup is the visual source of truth**: `docs/mockup/` (Claude Designer prototype) defines the
  layout, navigation, and component language to reproduce. The prototype is built with inline
  styles for speed; the production build translates that design into the project's styling approach
  (no inline styles, per CLAUDE.md) — a `plan.md` concern, not a visual change.
- **Claude entry point scaffolded as placeholder** *(confirmed)*: the Claude bottom tab and the
  dashboard "Ask Claude" card are built into the shell but route to a "Coming in Phase 3"
  placeholder — no chat, context injection, write, or undo behaviour this phase.
- **Currency uses pence** *(confirmed)*: figures render as `£X,XXX.XX` per CLAUDE.md; the mockup's
  whole-pound display (e.g. "£2,340") is treated as prototype shorthand, not the target format.
- **Categories are free-text with suggestions** *(confirmed)*: the bills sheet offers the mockup's
  six categories as quick picks but accepts any typed value, matching the Phase 1 free-text field;
  grouping is by whatever category string a bill carries.
- **Read-only is basic this phase**: previous months are rendered read-only by hiding/disabling
  edit controls; comprehensive read-only hardening and full error-state coverage (Pi offline, API
  failure handling) are completed in Phase 5.
- **Real-time means re-fetch**: "updates immediately / in real time" means the UI re-fetches fresh
  figures from the data layer after each write and re-renders — not optimistic client-side
  arithmetic on stale data.
- **Stale threshold**: an account balance is flagged stale when its as-of date is more than 30
  days before today, matching the Phase 1 feature file.
- **Locale**: currency is GBP and figures use en-GB grouping (`£X,XXX.XX`); timestamps display in
  the user's local time.
- **PIN/auth not included**: optional PIN protection is a Phase 5 concern and is not part of this
  phase.

## Out of Scope

Claude screen, chat interface, context injection, direct writes, and "Undo last Claude change"
(Phase 3); backup automation and JSON export (Phase 4); PIN/auth, comprehensive error-state
hardening, and the fresh-Pi end-to-end setup test (Phase 5); any change to the Phase 1 backend
data model or calculation logic.
