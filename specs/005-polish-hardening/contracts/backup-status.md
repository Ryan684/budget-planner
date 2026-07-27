# Contract: `GET /api/backup-status`

Surfaces the health of the Phase 4 nightly backup by reading its run log. Read-only; derives
everything from `BACKUP_LOG_FILE` — no DB state.

## Response 200

```json
{ "status": "success", "last_run_at": "2026-07-26T02:30:00Z", "stale": false }
```

| Field | Type | Notes |
|---|---|---|
| `status` | `"success"` \| `"failed"` \| `"unknown"` | Result of the most recent logged run |
| `last_run_at` | string (UTC ISO-8601) \| `null` | Timestamp of the last logged run; `null` when `unknown` |
| `stale` | boolean | `true` only when `status == "success"` and the run is older than `BACKUP_STALE_HOURS`; always `false` when `unknown` |

The endpoint always returns `200` (a missing log is a valid "unknown" state, not an error).

## Log parsing (input contract — Phase 4 `scripts/backup.sh`)

Each run appends one line to `BACKUP_LOG_FILE`:

```
[2026-07-26T02:30:00Z] SUCCESS
[2026-07-26T02:30:00Z] FAILED: git push
```

- Take the **last** line matching `^\[(<ISO-8601 UTC>)\] (SUCCESS|FAILED)(:.*)?$`.
- Extract the bracketed UTC timestamp → `last_run_at`; the keyword → `status` (`success`/`failed`).
- If the very last line is a partial mid-write line, fall back to the last *complete* matching line.

## Degradation (FR-016)

| Condition | Result |
|---|---|
| `BACKUP_LOG_FILE` blank (dev default) | `{status: "unknown", last_run_at: null, stale: false}` |
| File does not exist / not readable | `{status: "unknown", ...}` |
| File present but no parseable line | `{status: "unknown", ...}` |

A `unknown` status MUST NOT produce a dashboard banner (no false alarms in dev).

## Staleness

- `stale = (now_utc - last_run_at) > BACKUP_STALE_HOURS` (default 36), timezone-aware UTC.
- Only meaningful for `success`; a `failed` status already warrants a banner regardless of age.

## Dashboard banner logic (frontend consumer)

```
show warning banner  ⇐  status == "failed"  OR  (status == "success" AND stale)
hide banner          ⇐  (status == "success" AND NOT stale)  OR  status == "unknown"
```

Banner copy distinguishes the two cases, e.g.:
- failed  → "Last backup failed (2026-07-26 02:30). Check the Pi backup log."
- stale   → "No successful backup in over 36 hours. Check the Pi backup timer."
