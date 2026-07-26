# Phase 1 Data Model: Backup Automation

This feature introduces **no new database tables or columns** — it reads the existing schema and
emits backup *artifacts*. The "entities" below are the artifact and configuration shapes the backup
produces and consumes.

---

## 1. JSON export artifact (`budget-export.json`)

A full-history, human-readable snapshot. Envelope wraps the existing
`claude_context.build_budget_context()` payload so there is a single source of truth for "the
household's full financial picture".

```jsonc
{
  "exported_at": "2026-06-24T02:30:01Z",   // UTC ISO-8601, when the export was generated
  "schema_version": 1,                       // bump if the envelope/body shape changes
  "data": {
    "current_month_id": 7,
    "months": [
      {
        "id": 1,
        "month": "2026-01",
        "income":  [ { "id": 1, "label": "Ryan salary", "amount": 3200.0, "is_recurring": true } ],
        "bills":   [ { "id": 1, "label": "Mortgage", "amount": 1100.0, "category": "Housing",
                       "is_recurring": true, "due_date": 1 } ],
        "summary": { "total_income": 3200.0, "total_bills": 1100.0, "monthly_surplus": 2100.0 }
      }
      // ... every month, ascending
    ],
    "accounts": [
      { "id": 1, "label": "Joint current", "balance": 4200.0, "account_type": "current",
        "as_of_date": "2026-06-20", "is_stale": false }
    ],
    "balance_snapshots": [
      { "account_id": 1, "balance": 4200.0, "as_of_date": "2026-06-20" }
    ],
    "amendments": [
      { "id": 1, "month_id": 7, "entity_type": "bill", "entity_label": "Electricity",
        "field_changed": "amount", "old_value": "85.0", "new_value": "97.0",
        "reason": "tariff increase", "source": "user", "amended_at": "2026-06-21T09:14:00Z" }
    ]
  }
}
```

**Rules / invariants**
- `data` is exactly the output of `build_budget_context()` (stable key order → deterministic,
  diff-friendly, reproducible).
- Money values are `REAL`/float (GBP), consistent with the live schema and constitution Principle V.
- Timestamps inside `data` are UTC ISO-8601 (as `build_budget_context` already renders them);
  `exported_at` is likewise UTC.
- **Never contains**: the raw `.env`, `ANTHROPIC_API_KEY`, `APP_PIN`, or any secret. (None of these
  are in the DB; the envelope adds only `exported_at`/`schema_version`.) — FR-007.
- Must be parseable standalone (`json.loads`) without the app — FR-004, verified before commit.

---

## 2. Database copy artifact (`budget.db`)

A transactionally consistent copy of the live SQLite database, produced by the SQLite online-backup
API.

**Rules / invariants**
- Identical filename every run (`budget.db`) — git history is the version timeline (FR-003).
- Must pass `PRAGMA integrity_check` (single `ok` row) before it is committed — FR-004a / SC-008.
- Contains only budget data (no secrets are stored in the DB).
- Restoring it = copying it back to `DATABASE_URL` and restarting the app (US2 / FR-011).

---

## 3. Backup run record (local log line)

Appended to `$BACKUP_LOG_FILE` on the Pi, one line per run.

```
[2026-06-24T02:30:03Z] SUCCESS
[2026-06-25T02:30:02Z] FAILED: push rejected (remote unreachable)
```

**Rules / invariants**
- One line per run; timestamp is UTC ISO-8601 (FR-008).
- Failures include a short stage/reason (`verify`, `integrity_check`, `git push`, …).
- Lives **locally on the Pi**, not only in the repo, so push failures are still recorded (FR-008).
- Append-only in practice (the script only appends); rotation is an ops concern, out of scope.

---

## 4. Configuration (environment, Pi-only)

Consumed by `scripts/backup.sh` (read from `.env.production`); **not** added to the app's
`config.py`.

| Variable | Meaning | Example |
|---|---|---|
| `DATABASE_URL` | Source DB (existing setting, reused) | `/mnt/usbssd/budget.db` |
| `BACKUP_REPO_DIR` | Cloned private backup repo working tree | `/mnt/usbssd/budget-backup` |
| `BACKUP_LOG_FILE` | Local run log | `/var/log/budget-backup.log` |
| `BACKUP_LOCK_FILE` | `flock` lockfile (single-instance guard) | `/run/budget-backup.lock` |

**Rules / invariants**
- All values environment-driven, nothing hardcoded (`CLAUDE.md`).
- `BACKUP_REPO_DIR` is a *separate* repo from the app source (FR-006), authenticated to GitHub via
  an SSH key configured at Pi setup (prerequisite, not performed by the script).
