# Phase 1 Data Model: Polish & Hardening

**No database schema changes.** Phase 5 adds no tables and no columns — all three new concepts are
*derived* at request time. This file documents those derived shapes and the API payloads.

## Derived concepts (not stored)

### Current month

- **Definition**: the `BudgetMonth` whose `month` (`YYYY-MM`) equals the current **local** calendar
  month on the server. May be `None` if that month has not been created yet.
- **Resolution**: single backend helper (`current_month.py` / `deps.current_calendar_month_id`) and
  a matching frontend computation in `useMonths`. Supersedes the previous "latest month" definition.
- **Used by**: UI editable-month flag, backend read-only guard, Claude write target, dashboard
  default.

### Unlock state

- **Definition**: whether the current browser session has passed the PIN gate.
- **Lifetime**: frontend session only (e.g. `sessionStorage`); never persisted server-side, never
  in the DB. Re-locks when the browser session ends.

### Backup status

- **Definition**: derived from the Phase 4 run log (`BACKUP_LOG_FILE`), not stored in the DB.
- **Fields**: `status` ∈ {`success`, `failed`, `unknown`}; `last_run_at` (UTC ISO-8601 or `null`);
  `stale` (bool — last run older than `BACKUP_STALE_HOURS`; always `false` when `unknown`).

## Configuration (new settings)

| Setting | Env var | Default | Purpose |
|---|---|---|---|
| `backup_log_file` | `BACKUP_LOG_FILE` | `""` (blank ⇒ status `unknown`) | Path to the Phase 4 run log the status endpoint reads |
| `backup_stale_hours` | `BACKUP_STALE_HOURS` | `36` | Age (hours) beyond which a last-successful backup is "stale" |

`app_pin` already exists (`APP_PIN`, blank disables the gate). `BACKUP_LOG_FILE` is already produced
and consumed by the Phase 4 `scripts/backup.sh`; Phase 5 only *reads* it.

## API payloads (Pydantic schemas)

### `POST /api/verify-pin`

Request:

```json
{ "pin": "1234" }
```

Response `200`:

```json
{ "ok": true }
```

- `ok: false` for a well-formed but incorrect PIN (not an HTTP error).
- `400` if called when no PIN is configured (defensive; the frontend should not call it then).
- `422` on malformed input (missing/`non-string pin`).

### `GET /api/pin-required`

Response `200`:

```json
{ "required": true }
```

- `true` when `app_pin` is non-blank, else `false`. Lets the frontend decide whether to show the
  gate without shipping the PIN or a build-time flag.

### `GET /api/backup-status`

Response `200`:

```json
{ "status": "success", "last_run_at": "2026-07-26T02:30:00Z", "stale": false }
```

- `status`: `success` | `failed` | `unknown`.
- `last_run_at`: UTC ISO-8601 of the last logged run, or `null` when `unknown`.
- `stale`: `true` only when `status == success` and the run is older than `BACKUP_STALE_HOURS`.

## Read-only guard (behavioural, existing entities)

No shape change to `IncomeEntry` / `Bill` / `BudgetMonth`. The guard adds a precondition to
existing write endpoints:

| Endpoint | Change |
|---|---|
| `POST /api/months/{id}/income`, `PATCH /api/income/{id}`, `DELETE /api/income/{id}` | Reject with `403` when the target income's `month_id` ≠ current calendar month |
| `POST /api/months/{id}/bills`, `PATCH /api/bills/{id}`, `DELETE /api/bills/{id}` | Reject with `403` when the target bill's `month_id` ≠ current calendar month |
| `PATCH /api/months/{id}` (notes) | **Not guarded** — notes editable on any month |
| Account endpoints | **Not guarded** — accounts are not month-scoped |
| Carry-forward (`POST /api/months` with carry-forward) | **Not guarded** — reads previous month, writes only the new month (FR-010) |
