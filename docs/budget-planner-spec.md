# Family Budget Planner — Project Spec (v3)

## Overview

A private, self-hosted monthly budget planning app running on a Raspberry Pi 5. Accessible from any phone browser on home WiFi (local IP) or remotely via Tailscale. No cloud dependency for primary data. Claude is integrated via the Anthropic API for natural language querying, analysis, forecasting, and direct data writes against live budget data.

---

## Goals

- Replace Google Sheets as the family budget tool
- Model: income minus fixed bills equals monthly surplus
- Record actual account balances manually for Claude to reason against real money
- Allow Ryan and Robyn to view, amend, and query the budget from their phones
- Claude provides analysis, forecasting, and planning via natural language
- Data must be durable and privately backed up

---

## Non-Goals (MVP)

- Discretionary pot allocation (dropped — no bank integration means allocations don't reflect reality)
- Day-to-day transaction/spending tracking
- Bank account syncing or open banking integration
- Receipt scanning or auto-categorisation
- User accounts or separate logins
- Google Drive backup (noted for future consideration)
- Push notifications or scheduled summaries
- Tax planning (post-MVP — noted as future direction)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | FastAPI (Python) |
| Frontend | React + Vite |
| Database | SQLite (file on USB SSD attached to Pi) |
| AI | Anthropic API (claude-sonnet-4-6) |
| Hosting | Raspberry Pi 5, served on local network |
| Remote access | Tailscale (infrastructure prerequisite, outside app scope) |
| Backup | Automated nightly Git push to private GitHub repo |

Consistent with the morning dashboard stack — no new tooling.

---

## Data Model

### `budget_months`
| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| month | TEXT | Format: YYYY-MM |
| notes | TEXT | Optional freetext |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `income_entries`
| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| month_id | FK → budget_months | |
| label | TEXT | e.g. "Ryan salary", "Robyn freelance" |
| amount | REAL | |
| is_recurring | BOOLEAN | Carries forward to next month if true |

### `bills`
| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| month_id | FK → budget_months | |
| label | TEXT | e.g. "Mortgage", "Electricity" |
| amount | REAL | |
| category | TEXT | e.g. "Housing", "Utilities", "Childcare" |
| is_recurring | BOOLEAN | |
| due_date | INTEGER | Day of month, optional |

### `account_balances`
Not month-scoped — these are persistent records updated in place whenever the user checks their banking app.

| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| label | TEXT | e.g. "Joint current", "Savings", "Ryan ISA" |
| balance | REAL | Current balance |
| as_of_date | DATE | Date balance was recorded |
| account_type | TEXT | "current" or "savings" |
| notes | TEXT | Optional |

### `account_balance_snapshots`
Append-only time-series record. A row is written every time an account balance is updated.
This is what gives Claude a reliable, correctly-dated history for trend analysis and
forecasting — the `account_balances` table holds only the current value.

| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| account_id | FK → account_balances | |
| balance | REAL | Balance at the time of recording |
| as_of_date | DATE | Date the balance was observed in the banking app |
| recorded_at | TIMESTAMP | When the row was written (UTC) |

### `amendments`
| Field | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| month_id | FK → budget_months | |
| entity_type | TEXT | "bill", "income", "account_balance" |
| entity_id | INTEGER | FK to relevant table |
| field_changed | TEXT | e.g. "amount", "balance" |
| old_value | TEXT | |
| new_value | TEXT | |
| reason | TEXT | Optional, populated by Claude when it writes |
| source | TEXT | "user" or "claude" |
| amended_at | TIMESTAMP | |

The `source` field distinguishes Claude-initiated writes from manual edits. For `account_balance` amendments, `month_id` records the active budget month at the time the change was made — not a foreign key from the account record itself (which is not month-scoped).

---

## Budget Logic

```
total_income  = sum of income_entries
total_bills   = sum of bills
monthly_surplus = total_income - total_bills
total_savings = sum of account_balances (savings/investment accounts)
total_balances = sum of all account_balances
```

**Monthly surplus** is the headline figure — what's left after all bills are paid. Claude uses this alongside recorded account balances for forecasting and planning.

**Month creation:** When creating a new month, the app offers to carry forward all recurring income entries and recurring bills, pre-populated with last month's amounts. Account balances are not carried forward automatically — they are updated manually when the user checks their banking app.

---

## Application Structure

### Screens (mobile-first)

**Dashboard — current month**
- Total income / total bills / monthly surplus at a glance
- Account balances summary (total across all accounts)
- Quick-access Claude chat button
- Navigation to previous months
- Links to Income, Bills, Accounts, Amendments

**Income**
- List of income entries for the month
- Add / edit / delete entries
- Toggle recurring

**Bills**
- List of bills grouped by category with category subtotals
- Add / edit / delete
- Toggle recurring
- Optional due date per bill
- Visual warning if total bills exceed total income

**Accounts**
- List of manually recorded account balances
- Each account has a label, balance, and "as of" date
- Add / edit / delete accounts
- Total across all accounts shown prominently
- Accounts are not month-scoped — they persist and are updated whenever the user checks their banking app
- Claude uses these balances for forecasting and planning

**Claude**
- Chat-style interface
- Full financial context sent with each query (all months' income, bills, surplus, and account balances with history)
- Claude can read and write directly
- "Undo last Claude change" button visible whenever Claude has made a write in the current session
- Conversation resets per session (no persistent chat history in MVP)

**Month Management**
- Create new month (with carry-forward prompt for recurring items)
- View/switch previous months
- Read-only view of past months

**Amendments Log**
- Chronological list of all changes for the viewed month
- Shows source, field changed, old value, new value, reason, and timestamp

---

## Claude Integration

### AI Boundary (Privacy ADR)

> **Amended 2026-06-18:** widened from "current month + one explicitly requested prior month"
> to the full multi-month picture. Rationale: the household self-hosts and consents to analysis
> of its own finances, and cross-month context is what makes forecasting and trend analysis
> genuinely useful. Writes are unaffected — still current-month only. Mirrored in constitution
> Principle IV (v1.1.0) and `CLAUDE.md`.

Claude is called only from the Claude screen. Each call sends the household's full financial
picture so Claude can analyse and forecast across time:

- The structured budget for every month (income, bills, surplus)
- All account balances (with as-of dates) and their historical changes
- The amendments log
- The user's message

**What is never sent:** the raw database file, application secrets, `.env`, or the PIN — only
the structured financial data above.

Writes remain confined to the active current month — previous months are read-only.

### Write Behaviour

Claude can write directly to the database. The interaction pattern is **confirm-then-act**: Claude states what it intends to do before executing, so misunderstandings are visible immediately. Every Claude-initiated write is tagged `source: "claude"` in the amendments log with an auto-populated reason field.

Example:

> User: *"Add a £120 boiler service as a one-off bill"*
>
> Claude: *"Adding £120 one-off bill: Boiler service. That brings your monthly surplus to £1,280."*
>
> [write executes in same turn]

### Undo

An "Undo last Claude change" button appears on the Claude screen after any Claude write in the current session. It reverts the most recent Claude-initiated amendment. It does not undo manual user edits. The button disappears when there is nothing Claude-initiated to undo in the current session.

### System Prompt (outline)

```
You are a helpful family budget assistant. You have access to the
current monthly budget and account balances below, and can read
and write to them directly.

When making a change:
- State what you are doing and its effect on surplus or balances
  before executing
- Tag every write with a clear reason
- Never invent numbers not present in the data
- If an instruction is ambiguous, ask for clarification before writing
- Do not write to previous months — they are read-only

You can help with:
- Budget questions and analysis
- Forecasting savings growth based on monthly surplus
- Scenario modelling ("what if the mortgage goes up £150?")
- Month-on-month comparisons
- Planning toward financial goals

Be concise — the user is on a phone.

[budget and accounts JSON injected here]
```

### Example Natural Language Interactions

- *"What's our surplus this month?"* → reads and answers
- *"Add a £45 water bill"* → states intent, writes bill, reports new surplus
- *"If the mortgage goes up £150, what needs to change?"* → scenario modelling, no write unless asked
- *"How does this month compare to last month?"* → fetches both months, compares
- *"If we save £500/month, when do we hit £20,000?"* → forecasts from account balances + surplus
- *"How does this month's surplus compare to our average?"* → reads history, calculates

---

## Backup Strategy

### Mechanism
A nightly cron job on the Pi:

1. Copies the SQLite DB file to a timestamped export directory
2. Generates a JSON export of the current and previous month
3. Git commits and pushes to a private GitHub repository via SSH

### Setup Requirements
- SSH key on the Pi authorised against the GitHub repo
- Cron job configured at Pi setup time (documented in README)
- Backup repo separate from the app source repo

### Recovery
To restore: clone the backup repo, copy the DB file back to the data directory, restart the app. The JSON exports provide a human-readable fallback if the SQLite file is ever corrupt.

---

## Access & Auth

- App served on local network IP (e.g. `http://192.168.x.x:3000`)
- Remote access via Tailscale — infrastructure concern, outside app scope
- No login system in MVP
- Optional: simple 4-digit PIN stored in environment config, shown on first load
- Future consideration: proper user accounts if access model changes

---

## Phased Implementation Plan

### Phase 0 — Infrastructure
- Pi setup: USB SSD mounted, Node + Python + SQLite installed
- Repo initialised, README with setup instructions
- FastAPI skeleton with health check endpoint
- React + Vite scaffold, confirms it loads on phone browser
- Backup repo created on GitHub, SSH key configured, cron job stub

### Phase 1 — Data Layer
- SQLite schema created (all tables above)
- FastAPI CRUD endpoints for all entities
- Month creation with carry-forward logic
- Budget calculation logic (income / bills / surplus)
- Account balances CRUD (not month-scoped)
- Vitest unit tests for budget calculation logic

### Phase 2 — Core UI
- Mobile-first React frontend
- Dashboard screen
- Income, Bills, Accounts screens
- Month management (create, switch, carry-forward prompt)
- Amendments log screen
- All screens functional against real data, no Claude yet

### Phase 3 — Claude Integration
- Claude screen with chat interface
- System prompt with budget and accounts context injection
- Natural language querying and direct writes working end-to-end
- Confirm-then-act pattern enforced in system prompt
- Undo last Claude change implemented
- `source` field populated on all Claude-initiated amendments
- Privacy boundary enforced in API call construction (structured multi-month financial data only — never the raw DB file, secrets, or PIN)

### Phase 4 — Backup Automation
- Cron job script finalised and tested
- Nightly DB copy + JSON export
- Git commit and push to private backup repo
- Recovery procedure documented and tested

### Phase 5 — Polish & Hardening
- PIN protection (optional, config-driven)
- Previous month read-only view enforced throughout
- Error states (Pi offline, API failure, backup failure alert)
- README: full setup guide including Tailscale instructions
- End-to-end test: fresh Pi setup from README

---

## Future Considerations (post-MVP)

- Tax planning — e.g. salary threshold awareness (£100k personal allowance taper)
- Google Drive backup as secondary offsite copy
- Savings goals tracking with progress indicators
- Simple month-on-month trend charts
- Recurring bill change detection ("this bill is £12 more than last month")
- Open banking / read-only bank feed integration to auto-update account balances
- Proper user accounts if access model evolves
- Persistent Claude conversation history across sessions
- Discretionary pot allocation if bank integration is added (making allocations meaningful)
