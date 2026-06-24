# Phase 1 Data Model: Claude Integration

Phase 3 adds **one persisted table** and several **transient (non-persisted) structures**. The existing
`budget_months`, `income_entries`, `bills`, `account_balances`, and `amendments` tables are unchanged
in shape; the only data-layer change is the new snapshot table plus a snapshot write inside the existing
account-balance write path.

---

## 1. `account_balance_snapshots` (new, persisted, append-only)

A first-class, correctly-dated time series of account balances. One row is written on **every** account
balance create or update — by users and by Claude alike — so cross-month balance trend analysis does not
depend on reconstructing history from the general amendments log (FR-023, research.md §6).

| Field | Type (SQLite) | Notes |
|---|---|---|
| `id` | INTEGER PK | Autoincrement |
| `account_id` | INTEGER, indexed | Plain integer reference to `account_balances.id`. **Not an enforced FK** — mirrors the `amendments.entity_id` pattern so deleting an account preserves its snapshot history. |
| `balance` | REAL (float) | The balance value recorded at this observation. GBP. |
| `as_of_date` | DATE | The user-stated observation date for this balance (copied from the account's `as_of_date` at write time). |
| `recorded_at` | DATETIME (tz-aware, UTC) | When the snapshot row was written. Default `datetime.now(UTC)`. |

**Rules**
- **Append-only** — snapshot rows are never updated or deleted (same durability rule as `amendments`).
- Written transactionally with the balance change: if the account write rolls back, no snapshot row is
  committed.
- Ordering for trend analysis is by `as_of_date` (observation order), with `recorded_at` as a tiebreaker.

**SQLAlchemy model** (in `backend/models.py`, alongside `AccountBalance`):

```python
class AccountBalanceSnapshot(Base):
    """Append-only balance time series. One row per balance create/update."""
    __tablename__ = "account_balance_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    balance: Mapped[float] = mapped_column(Float, nullable=False)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
```

**Migration**: dev DB is recreated via `Base.metadata.create_all` on startup. For any existing DB,
the documented manual step is `CREATE TABLE account_balance_snapshots (...)` plus an optional one-time
backfill of one snapshot per existing account from its current balance/`as_of_date`.

---

## 2. Claude write / amendment (existing table, reused)

No schema change. Claude writes go through the existing `crud.py` helpers and land in the `amendments`
table with `source="claude"`, the changed field, old/new values, and a populated `reason` (FR-012,
Constitution V). Undo appends **new reversing amendments** (also `source="claude"`) rather than deleting
rows (research.md §9). The unit of undo is the most recent Claude **turn** (all amendments sharing that
turn), per the 2026-06-20 clarification.

> **Note on turn grouping**: the MVP does not add a `turn_id` column to `amendments`. The frontend holds
> the per-turn list of amendment ids it received in each response and passes them to the undo endpoint;
> the backend reverses exactly those. (A persisted `turn_id` is a possible future enhancement, recorded
> here so a later session doesn't assume it exists.)

---

## 3. Budget context payload (transient — built per request, not persisted)

The privacy-bounded JSON snapshot sent to Claude (FR-002, FR-022, Constitution IV). Built by
`claude_context.py` from the live DB on each request. **Excludes** the raw DB file, secrets, `.env`, and
the PIN.

```jsonc
{
  "current_month_id": 7,                 // the active (latest) month — the only writable month
  "months": [
    {
      "id": 7, "month": "2026-06",
      "income": [{ "id": 31, "label": "Salary", "amount": 3200.0, "is_recurring": true }],
      "bills":  [{ "id": 88, "label": "Mortgage", "amount": 1100.0, "category": "Housing",
                   "is_recurring": true, "due_date": 1 }],
      "summary": { "total_income": 3200.0, "total_bills": 1100.0, "monthly_surplus": 2100.0 }
    }
    // ... every month, oldest→newest
  ],
  "accounts": [
    { "id": 4, "label": "Savings", "balance": 8400.0, "account_type": "savings",
      "as_of_date": "2026-05-06", "is_stale": true }       // is_stale = as_of_date ≥30 days ago
  ],
  "balance_snapshots": [
    { "account_id": 4, "balance": 8000.0, "as_of_date": "2026-04-01" },
    { "account_id": 4, "balance": 8400.0, "as_of_date": "2026-05-06" }
  ],
  "amendments": [
    { "id": 120, "month_id": 7, "entity_type": "bill", "entity_label": "Mortgage",
      "field_changed": "amount", "old_value": "1050.0", "new_value": "1100.0",
      "reason": "Rate change", "source": "user", "amended_at": "2026-06-02T09:00:00Z" }
  ]
}
```

**Validation / construction rules**
- `current_month_id` = `latest_month_id(session)`; it is the **only** month Claude may write to.
- Figures (`total_income`, `total_bills`, `monthly_surplus`) come from `budget.py` — never recomputed
  by hand client- or prompt-side (Constitution V).
- `is_stale` reflects the ≥30-day rule (research.md §7).
- `balance_snapshots` ordered by `as_of_date`.
- Whole payload is serialized deterministically (stable key order) so it is reproducible and testable.

---

## 4. Conversation session (transient — frontend React state)

Not persisted (no cross-session history — FR-007/FR-019). Lives in `useClaudeSession.ts`.

| Field | Type | Notes |
|---|---|---|
| `messages` | `ClaudeMessage[]` | Running dialogue: `{ role: "user" \| "assistant", content }`. Sent with each request; trimmed oldest-first by the backend only if the payload would overflow context (research.md §10). |
| `claudeWrites` | `ClaudeTurnWrites[]` | Ordered list of the writes Claude made this session, grouped by turn. Each entry holds the turn's amendment ids + reversal descriptors returned by the backend. Drives the undo control. |

- Cleared when the Claude screen is closed/left (session-scoped).
- `claudeWrites` non-empty ⇒ "Undo last Claude change" is shown/active (FR-016); empty ⇒ hidden/inactive.
- Undo pops the most recent `ClaudeTurnWrites` entry and calls the undo endpoint with its descriptors.

---

## 5. Tool-call inputs (transient — Anthropic tool schemas)

Defined in `claude_tools.py`; supplied to the API via the `tools` parameter. Each carries a required
`reason`. No `month_id` field is exposed — writes are forced to the current month server-side (FR-014,
research.md §4).

| Tool | Input fields (besides `reason`) | Maps to |
|---|---|---|
| `add_bill` | `label`, `amount`, `category`, `is_recurring?`, `due_date?` | `crud.create_entity` (Bill) |
| `update_bill` | `bill_id`, + any of `label`/`amount`/`category`/`is_recurring`/`due_date` | `crud.update_entity` (Bill) |
| `delete_bill` | `bill_id` | `crud.delete_entity` (Bill) |
| `add_income` | `label`, `amount`, `is_recurring?` | `crud.create_entity` (IncomeEntry) |
| `update_income` | `income_id`, + any of `label`/`amount`/`is_recurring` | `crud.update_entity` (IncomeEntry) |
| `delete_income` | `income_id` | `crud.delete_entity` (IncomeEntry) |
| `update_account_balance` | `account_id`, `balance`, `as_of_date?` | `crud.update_entity` (AccountBalance) + snapshot row |

**Dispatch rules**
- Every tool validates that the referenced entity belongs to the current month (bills/income) or exists
  (account); a mismatch/not-found returns a tool error → whole-turn rollback (FR-011/FR-015).
- Amounts validate `ge=0` (reuse existing schema constraints); a request that would create a negative
  amount is surfaced for confirmation, not written blindly (Edge Cases).
- All tool writes in one turn share one transaction; any failure rolls the whole turn back.
