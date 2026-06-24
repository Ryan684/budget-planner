# Contract: `/api/claude` endpoints

The only endpoints from which Claude is called (Constitution IV). Non-streaming: each `POST /api/claude`
returns one complete JSON response per turn (clarification 2026-06-20). All money is REAL/float GBP;
timestamps UTC ISO-8601. Pydantic schemas live in `backend/schemas.py`; the router is `routers/claude.py`.

---

## `POST /api/claude` — send a message, get a grounded response (and any writes)

Sends the user message + session conversation; the backend builds the privacy-bounded financial context
(data-model.md §3), runs the manual tool-use loop against `claude-sonnet-4-6`, applies any current-month
writes atomically, and returns Claude's reply plus the writes made and the refreshed budget figures.

### Request

```jsonc
{
  "message": "add a £45 water bill",
  "conversation": [                       // prior turns this session; [] on first message
    { "role": "user", "content": "what's our surplus this month?" },
    { "role": "assistant", "content": "Your surplus this month is £2,100.00." }
  ]
}
```

`schemas.ClaudeRequest`:
- `message: str` — required, non-empty.
- `conversation: list[ClaudeMessage]` — default `[]`. `ClaudeMessage = { role: "user"|"assistant", content: str }`.

The backend does **not** accept a month id or any financial data from the client — it builds the context
itself from the live DB, and writes always target the current (latest) month.

### Response `200`

```jsonc
{
  "reply": "I'll add a £45.00 water bill. That lowers your surplus from £2,100.00 to £2,055.00. Done.",
  "writes": [                              // [] for read-only / query turns
    {
      "amendment_id": 131,
      "entity_type": "bill",
      "entity_id": 92,
      "entity_label": "Water",
      "field_changed": "created",
      "old_value": null,
      "new_value": "Water (£45.00)",
      "reason": "User asked Claude to add a £45 water bill"
    }
  ],
  "summary": {                             // refreshed current-month figures (budget.py) — never stale
    "month_id": 7, "month": "2026-06",
    "total_income": 3200.0, "total_bills": 1145.0, "monthly_surplus": 2055.0,
    "total_balances": 8400.0, "total_savings": 8400.0
  }
}
```

`schemas.ClaudeResponse`:
- `reply: str` — Claude's complete text for the turn (includes its stated intent/effect for writes,
  FR-009; and the stale-balance flag + as-of date when a write touches a stale balance).
- `writes: list[ClaudeWrite]` — one entry per amendment written this turn (empty for queries). The
  frontend stores this list (grouped as one turn) to drive undo.
- `summary: BudgetSummary` — recalculated current-month figures after any write (FR-013). Reuses the
  existing `BudgetSummary` schema.

### Behaviour

- **Query turns** return `reply` + `summary`, `writes: []`, and write nothing (FR-003/FR-006). Claude
  must not invent figures absent from the context (FR-004).
- **Write turns** state intent/effect in `reply` and apply the write(s) in the same turn (FR-009/FR-010).
  All writes in the turn share one transaction; any failure rolls the whole turn back and logs nothing
  (FR-015, atomic per clarification).
- **Ambiguous requests** (e.g. two "insurance" bills) → `reply` asks for clarification, `writes: []`
  (FR-011).
- **Previous-month / read-only writes are impossible**: tools never accept a month id and target the
  current month only; if the user is viewing a prior month the UI is read-only and Claude explains it
  cannot write there (FR-014). No data is altered.
- **Context overflow**: backend trims oldest `conversation` entries via `count_tokens` until the payload
  fits; financial context is never trimmed (clarification).

### Errors

| Status | When | Body | Effect |
|---|---|---|---|
| `422` | Missing/empty `message`, malformed body | FastAPI validation detail | No call to Anthropic; no write. |
| `502` | Anthropic unreachable/timeout/refusal/API error (`APIConnectionError`, `APITimeoutError`, `RateLimitError`, `APIStatusError`, or a `refusal` stop reason) | `{ "detail": "The assistant is unavailable right now. Please try again." }` | Turn transaction rolled back; budget unchanged (Edge Cases, SC-007). |
| `409` | A write target was deleted between statement and execution | `{ "detail": "<what failed>" }` | Whole turn rolled back; no amendment logged. |

The frontend renders 502/409 as a friendly inline error on the Claude screen and does **not** add the
turn to `claudeWrites`.

---

## `POST /api/claude/undo` — revert the most recent Claude turn

Reverses, as one unit, the writes from the most recent Claude turn this session (FR-017, per-turn
granularity per clarification). Reversal is applied through the normal write path as **new** reversing
amendments tagged `source:"claude"` — amendment rows are never deleted (Constitution V, research.md §9).

### Request

```jsonc
{ "amendment_ids": [131] }     // the turn's amendment ids, from the prior response's "writes"
```

`schemas.ClaudeUndoRequest`:
- `amendment_ids: list[int]` — required, non-empty; the ids the frontend recorded for the most recent
  Claude turn.

### Response `200`

```jsonc
{
  "reverted": [131],
  "summary": { "month_id": 7, "month": "2026-06",
               "total_income": 3200.0, "total_bills": 1100.0, "monthly_surplus": 2100.0,
               "total_balances": 8400.0, "total_savings": 8400.0 }
}
```

`schemas.ClaudeUndoResponse`:
- `reverted: list[int]` — amendment ids that were reversed (newest-first within one transaction).
- `summary: BudgetSummary` — figures after the reversal (snap back to pre-turn state, FR-017).

### Behaviour

- Reverses only the named amendments and only those with `source="claude"`; a manual (`source="user"`)
  edit is never touched (FR-018). Mixed input → the user amendments are skipped (or `422`, see Errors).
- Inverse operations: a created entity is deleted; a deleted entity is re-created; a field change is
  restored to its `old_value`. Each reversal is itself logged as a new `source:"claude"` amendment with
  a reason like "Undo of Claude change #131".
- Reversing-all in one transaction keeps undo atomic.

### Errors

| Status | When | Body |
|---|---|---|
| `422` | Empty `amendment_ids`, or any id is not a `source:"claude"` amendment | validation detail |
| `404` | An amendment id does not exist | `{ "detail": "Amendment not found" }` |
| `409` | The current state can't be reversed cleanly (e.g. the entity was since changed by hand) | `{ "detail": "<reason>" }` — nothing reverted (transaction rolled back) |

---

## Privacy boundary (applies to every `/api/claude` call)

The request to Anthropic contains only: the system prompt, the structured financial context
(data-model.md §3 — all months, accounts, balance snapshots, amendments), the user message, the session
conversation, and the tool definitions. It **never** contains the raw DB file, application secrets,
`.env` contents, or the PIN (FR-022, SC-005, Constitution IV). Tests assert these exclusions against the
exact payload handed to the (mocked) Anthropic client.
