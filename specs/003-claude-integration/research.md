# Phase 0 Research: Claude Integration

All decisions below were resolved from the codebase, the project constitution/CLAUDE.md, the
2026-06-20 spec clarifications, and the bundled `claude-api` reference. No open `NEEDS CLARIFICATION`
items remain.

---

## 1. Anthropic client library

**Decision**: Official `anthropic` Python SDK, added to `backend/pyproject.toml` `[project.dependencies]`.

**Rationale**: User-confirmed (2026-06-20). The SDK gives typed exceptions (`APIConnectionError`,
`APITimeoutError`, `RateLimitError`, `APIStatusError`), built-in `messages.count_tokens()`, automatic
retries/back-off, and first-class tool-use request/response shapes — all of which this feature needs
and would otherwise be hand-rolled against raw httpx.

**Alternatives considered**: Raw HTTP via httpx (rejected — re-implements tool-use parsing, token
counting, and error handling that the SDK provides; the constitution already commits to the Anthropic
API, so the SDK is the natural fit).

---

## 2. Model and request shape

**Decision**: `claude-sonnet-4-6`, non-streaming `client.messages.create(...)`, `max_tokens` ≈ 4096.

**Rationale**: The model is pinned by the constitution and spec (Sonnet for cost efficiency). Responses
are short ("be concise — the user is on a phone"), so 4096 output tokens is ample and stays well under
SDK HTTP-timeout territory. Non-streaming matches the 2026-06-20 clarification (single complete
response, no token-by-token delivery in MVP). Sonnet 4.6 supports adaptive thinking; we omit `thinking`
(default off) for a snappy first response — revisit only if answer quality needs it.

**Alternatives considered**: Streaming/SSE (rejected for MVP per clarification — adds EventSource
plumbing for no required benefit on a fast LAN). Opus (rejected — constitution mandates Sonnet for
runtime calls).

---

## 3. Tool use: manual loop vs SDK tool runner

**Decision**: **Manual agentic loop** in `claude_client.py`. Define tools as JSON-schema dicts; loop
`client.messages.create(...)` until `stop_reason == "end_turn"`, executing each `tool_use` block via
`claude_tools.py` and feeding `tool_result` blocks back. Cap iterations (e.g. 8) as a safety stop.

**Rationale**: The confirm-then-act pattern, current-month-only enforcement, atomic per-turn rollback,
and amendment logging all require intercepting every tool call before it touches the DB. The manual
loop is exactly the "fine-grained control / human-in-the-loop-style gating" case the reference flags;
the beta tool runner auto-executes and hides that seam. The model states its intended change in the
*text* it emits alongside the `tool_use` block (system prompt enforces "state effect before executing"),
so a single turn carries both the statement and the executed write — satisfying FR-009/FR-010.

**Alternatives considered**: `client.beta.messages.tool_runner` (rejected — auto-executes tools; we
can't interpose the current-month guard, rollback, and logging cleanly).

---

## 4. Tool surface exposed to Claude

**Decision**: Dedicated, typed tools (not a generic "run SQL"):
`add_bill`, `update_bill`, `delete_bill`, `add_income`, `update_income`, `delete_income`,
`update_account_balance`. Each schema takes the entity fields plus a required `reason` string. All
writes target the **active current (latest) month**, resolved server-side via
`routers/deps.latest_month_id` — Claude does **not** pass a month id, removing any way to write to a
prior month.

**Rationale**: Dedicated tools give the backend a typed, auditable hook per action (gate, validate,
log) — the reference's recommended pattern for actions behind a security boundary. Reusing
`crud.create_entity/update_entity/delete_entity` with `source="claude"` and the tool's `reason` means
Claude writes flow through the exact same append-only amendment path as user writes (Constitution V).

**Alternatives considered**: A single `apply_change` tool with a free-form payload (rejected — pushes
validation/branching into prose and loses per-action typing). Letting Claude pass a `month_id`
(rejected — would make a previous-month write expressible; FR-014 forbids it, so the capability simply
isn't offered).

---

## 5. Atomic per-turn writes and rollback

**Decision**: Wrap all tool executions for one Claude turn in a **single SQLAlchemy transaction**. The
existing `crud.py` helpers call `session.commit()` per write; for the Claude path we will execute tool
writes within one transaction (using `flush` + a single final `commit`, or a savepoint per tool) and
roll the whole transaction back if any tool raises. No amendment rows survive a failed turn (FR-015).

**Rationale**: Clarification 2026-06-20 chose all-or-nothing. A turn that says "add a water bill and
update savings" must not leave a half-applied budget. Implementation note for `/speckit-tasks`: the
current `crud` helpers commit eagerly, so the Claude tool-dispatch layer needs a transaction-scoped
variant (parameterize commit, or use `session.begin()`/savepoints) — this is the one place the data
layer's write contract is extended. **Intentional, not a bug**: single-write turns still produce
exactly one amendment; the transaction wrapper changes durability semantics, not the logged output.

**Alternatives considered**: Best-effort with per-write commit + later undo (rejected by clarification).

---

## 6. Account balance snapshot table (FR-023)

**Decision**: New `account_balance_snapshots` table (append-only): `id`, `account_id`, `balance`,
`as_of_date`, `recorded_at` (UTC). Write one row on **every** balance create/update, inside the same
account-write path in `crud.py` / `routers/accounts.py`. Snapshots are included in the Claude context
payload as the balance time series.

**Rationale**: Per the progress log (2026-06-18) and FR-023, reconstructing balance history from the
general amendments log is unreliable (free-text values, deletions). A first-class, correctly-dated
series is what backs cross-month balance trend analysis (User Story 4). Append-only mirrors the
amendments table's durability rule.

**Alternatives considered**: Reconstruct from amendments (rejected — unreliable, per progress log).
Snapshot only on Claude writes (rejected — user edits also move balances; the series must be complete).

---

## 7. Stale-balance handling on reads and writes

**Decision**: A balance is stale at **≥30 days** (reuse Phase 2's rule). The context payload includes
each balance's `as_of_date`; the system prompt instructs Claude to cite the as-of date when an answer
uses a balance and to flag staleness (FR-005). Per clarification 2026-06-20, when a write targets a
stale balance, Claude includes the staleness flag + as-of date in its pre-write statement (FR-009).

**Rationale**: Consistency with the existing dashboard staleness treatment; the model is given the
dates and the rule rather than the backend computing a boolean, keeping the staleness logic in one
place (the prompt) for both reads and writes.

---

## 8. Conversation session state & undo location

**Decision**: The **frontend** holds session state — the running conversation (message array) and the
ordered list of Claude writes made this session. Each `/api/claude` request sends the prior
conversation; the backend is stateless between requests. The backend returns, for the turn, the list of
amendments it wrote (ids + reversal info) so the frontend can offer undo. "Undo last Claude change"
calls a backend undo endpoint that reverses the most recent Claude **turn's** writes as one unit.

**Rationale**: CLAUDE.md already specifies "the frontend tracks Claude writes within the current
session" and "session-scoped — resets when the Claude screen is closed." React state is the natural
home; closing/leaving the screen drops it (FR-019). Keeping the backend stateless avoids server-side
session storage in an MVP with no auth and a single shared user.

**Alternatives considered**: Backend in-memory session store keyed by session id (rejected — adds
server state and lifecycle management for no benefit given single shared access and frontend-owned undo).

---

## 9. Undo mechanics (append-only safe) and per-turn granularity

**Decision**: Undo reverses the **most recent Claude turn** as a unit (clarification 2026-06-20). It
does not delete amendment rows — instead it applies the inverse operation through the normal write path
(re-create a deleted entity, restore old field values, delete a created entity), producing **new**
reversing amendments tagged `source:"claude"` with a `reason` like "Undo of Claude change". The undo
endpoint receives the turn's amendment ids/operations from the frontend (or looks up the most recent
Claude turn) and reverses them newest-first within one transaction.

**Rationale**: The amendments table is append-only (Constitution V) — undo must not delete rows. Per-turn
bundling matches the clarified undo granularity and the user's mental model ("undo what Claude just
did"). Reversing within a transaction keeps undo itself atomic.

**Alternatives considered**: Deleting the original amendment rows (rejected — violates append-only).
Per-amendment undo (rejected by clarification — per-turn is the unit).

---

## 10. Context-window overflow handling

**Decision**: Before each request, estimate tokens with `client.messages.count_tokens(...)`. If the
payload (system prompt + financial JSON + conversation) would exceed a safe fraction of the
`claude-sonnet-4-6` context window, **trim the oldest conversation messages** (from the front) until it
fits. The financial JSON and system prompt are **never** trimmed (clarification 2026-06-20).

**Rationale**: Clarification chose trim-oldest-conversation. The financial history is the core value and
is small; the conversation is what grows. `count_tokens` gives an accurate, model-specific count (the
reference forbids `tiktoken`). In practice this path rarely triggers given the small data and 1M
context — it is a safety net, but it is specified and must be tested (FR/edge case).

**Alternatives considered**: Error + force new session, or truncate financial history (both rejected by
clarification).

---

## 11. Error handling ("assistant unavailable", write-fails-mid-turn)

**Decision**: Catch the SDK's typed exceptions in `claude_client.py` / the router. Map
`APIConnectionError` / `APITimeoutError` / `RateLimitError` / `APIStatusError` (and a refusal
`stop_reason`) to a clean HTTP error the frontend renders as a friendly message; **no partial write is
committed** (the turn's transaction is rolled back), so the budget is unchanged (Edge Cases;
FR-015; SC-007). A write that fails mid-turn (e.g. target deleted between statement and execution)
raises inside tool dispatch → whole-turn rollback → Claude reports the failure → no amendment logged.

**Rationale**: Typed exceptions are the reference's prescribed pattern (no string-matching). The atomic
transaction from §5 already guarantees "leave data untouched" on any failure path.

---

## 12. Prompt caching (optional optimization)

**Decision**: Optional, deferred. The financial JSON changes after every write, so it is a poor cache
prefix within a write-heavy session; the stable system-prompt header could be cached, but the payloads
are small and the benefit is marginal at family scale. Not implemented in MVP; noted for future tuning.

**Rationale**: Caching is a prefix match — the volatile financial JSON sits early in the payload and
would invalidate often. Low payoff for the added care; out of scope for the MVP slice.

---

## Summary of new/changed contracts

- **New table**: `account_balance_snapshots` (see data-model.md).
- **Modified write path**: account balance create/update also writes a snapshot row.
- **New endpoints**: `POST /api/claude` (message → response + writes), and a Claude-undo endpoint
  (see contracts/claude-api.md).
- **New dependency**: `anthropic` (backend runtime).
- **System prompt**: per CLAUDE.md, extended only to cover the stale-balance-on-write and per-turn
  framing; tool list supplied via the API `tools` parameter.
