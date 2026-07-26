# Contract: Previous-month read-only guard

Enforces FR-006/FR-007/FR-008: income and bills are editable **only** in the current calendar
month. Defence-in-depth behind the UI, and consistent with how Phase 3 already restricts Claude
writes to the current month.

## Definition of "current month"

The `BudgetMonth` whose `month` (`YYYY-MM`) equals the current **local** calendar month on the
server (see research.md §2). Resolved by one backend helper used by every write path.

## Guarded endpoints → `403 Forbidden`

Reject with `403` and detail `"This month is read-only — only the current month can be edited"`
when the target's `month_id` is not the current calendar month:

| Method | Path | Rejected when |
|---|---|---|
| POST | `/api/months/{month_id}/income` | `{month_id}` ≠ current month |
| PATCH | `/api/income/{income_id}` | income's `month_id` ≠ current month |
| DELETE | `/api/income/{income_id}` | income's `month_id` ≠ current month |
| POST | `/api/months/{month_id}/bills` | `{month_id}` ≠ current month |
| PATCH | `/api/bills/{bill_id}` | bill's `month_id` ≠ current month |
| DELETE | `/api/bills/{bill_id}` | bill's `month_id` ≠ current month |

`404` still takes precedence when the entity/month does not exist (existing behaviour).

## NOT guarded

| Path | Why |
|---|---|
| `PATCH /api/months/{id}` (notes) | Notes remain editable on any month (clarified 2026-07-26) |
| `POST /api/months` with carry-forward | Reads the previous month, writes only the new month (FR-010) — no write to a previous month occurs |
| `/api/accounts/*` | Accounts are not month-scoped (FR-009) |

## Status-code choice

`403 Forbidden` — the request is well-formed and the entity exists, but editing a historical month
is not permitted. Not `409` (no conflict) and not `422` (not a validation error). The frontend maps
a `403` on a write to a friendly "This month is read-only" message and refetches the true state.

## Edge cases

- **Current calendar month not created**: no month matches → every income/bill write is rejected
  (nothing is the current month) until the month is created; the UI instead offers "create this
  month". Claude reports it has no month to write to (existing behaviour).
- **Future month created ahead**: read-only until its calendar month arrives.
