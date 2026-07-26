# Phase 0 Research: Polish & Hardening

All "NEEDS CLARIFICATION" from the spec were resolved during `/speckit-clarify` (2026-07-26) and
the follow-up planning reconciliation. This file records the design decisions that shape Phase 1.

## 1. PIN verification path

- **Decision**: The frontend collects the PIN and posts it to a new `POST /api/verify-pin`
  endpoint that compares it against `settings.app_pin` server-side and returns a boolean-ish
  result. The PIN value is never embedded in the client bundle.
- **Rationale**: Chosen in clarification (backend-verify over browser-compare). Keeps the secret
  off the client while staying a lightweight "gate" — no session tokens, no auth on the rest of the
  API. Matches the accepted MVP security posture (network boundary via Tailscale/LAN).
- **Details**:
  - Constant-time compare (`hmac.compare_digest`) to avoid a trivial timing side-channel — cheap,
    stdlib, no downside.
  - When `app_pin` is blank, `verify-pin` is unnecessary; the frontend detects "no PIN configured"
    and skips the gate entirely (FR-002). How does the frontend know? Two options considered:
    (a) a `VITE_`-exposed boolean flag "pin enabled" (not the PIN itself), or (b) the gate always
    calls a tiny `GET /api/pin-required` on load. **Decision: (b)** — a single source of truth on
    the backend, no build-time frontend config, and it avoids shipping even a boolean that could
    drift from the server. `verify-pin` returns 400/"not configured" defensively if called when
    disabled.
  - Response shape: `200 {"ok": true}` / `200 {"ok": false}` for a well-formed attempt (wrong PIN
    is not an HTTP error — it's a normal negative result). Malformed input → 422 (Pydantic).
- **Alternatives rejected**: Browser-side compare (PIN in bundle — rejected in clarification);
  full API authentication with tokens (out of MVP scope — deferred per spec Assumptions).

## 2. "Current month" = calendar month (single definition)

- **Decision**: The current month is the `BudgetMonth` whose `month` (`YYYY-MM`) equals the current
  **local** calendar month on the server. A single helper resolves it and is used by: the UI
  editable month (`useMonths`), the backend read-only guard (income/bills), the Claude write target
  (replacing `latest_month_id`), and the dashboard default.
- **Rationale**: The clarified spec requires editing to track the real calendar month, and the
  planning reconciliation (user-confirmed 2026-07-26) requires one uniform definition to avoid two
  conflicting "current months" across the UI and Claude.
- **Details**:
  - **Timezone**: derived from local time, not UTC (`datetime.now()` on the Pi, whose clock is the
    household timezone Europe/London). "This month" is a local human concept; using UTC would flip
    the current month up to an hour early/late around month boundaries. Constitution V ("timestamps
    stored UTC, displayed local") is about stored timestamps — the *current-month* determination is
    a display/interaction concern and correctly uses local time. Documented as an explicit choice.
  - **Frontend parity**: `useMonths` computes the same `YYYY-MM` from the browser's local clock and
    matches it against the loaded months. Backend and frontend can momentarily disagree only across
    a month boundary; the backend guard is authoritative (a rejected write surfaces a clear error).
  - **Not-yet-created current month**: if no `BudgetMonth` matches the current calendar month, there
    is no editable month — the UI shows a "create this month" prompt (reusing the existing
    create-month flow) and Claude reports it has no month to write to (existing
    `_require_current_month` already raises "There is no current month to write to.").
  - **Future month created ahead**: it is read-only until its calendar month arrives (it is not the
    current month). This is the behaviour the user selected.
- **Cross-phase impact / divergence**: This supersedes shipped Phase 2 (`useMonths.editableMonthId`
  = latest) and Phase 3 (`latest_month_id` as the Claude target). Recorded as a Phase 3 spec
  divergence and a scoped Constitution IV wording amendment (Complexity Tracking). `latest_month_id`
  is retired from the write path; if any read-only view still needs "the newest month," it is a
  separate concern from "the editable month."
- **Alternatives rejected**: Keep latest-month (contradicts the clarified spec); hybrid where Claude
  uses latest and UI uses calendar (two conflicting current months — explicitly rejected in
  reconciliation).

## 3. Backend read-only guard

- **Decision**: A shared dependency/helper rejects create/update/delete of **income entries and
  bills** whose `month_id` is not the current calendar month, returning **HTTP 403** with a clear
  detail ("Previous months are read-only"). Applied in `income.py` and `bills.py`. Month **notes**
  (`PATCH /api/months/{id}` notes-only) are **not** guarded — notes stay editable on any month
  (clarified). Accounts are never month-scoped and are untouched.
- **Rationale**: FR-008 defence-in-depth behind the UI; matches how Phase 3 already blocks Claude
  writes to non-current months (`claude_tools._load_month_scoped`), giving user and Claude writes
  the same rule.
- **Details**:
  - **Status code**: 403 Forbidden (the request is well-formed and the entity exists, but the action
    is not permitted on a historical month) rather than 409/422. The frontend maps 403 on a write to
    a friendly "This month is read-only" message.
  - **Carry-forward is exempt** (FR-010): it creates rows in the *new* month and only *reads* the
    previous month — no write to a previous month occurs, so the guard never triggers there.
  - The guard resolves "current month" via the same helper as §2 (single source of truth).
- **Alternatives rejected**: UI-only enforcement (fails FR-008; a stray client or direct API call
  could still mutate history); 409 Conflict (not a conflict — it's a permission rule).

## 4. Backup status from the Phase 4 run log

- **Decision**: `GET /api/backup-status` reads `BACKUP_LOG_FILE`, takes the **last** line, and
  parses the Phase 4 format `"[<ISO-8601 UTC>] SUCCESS"` or `"[<ISO-8601 UTC>] FAILED: <reason>"`
  into `{status, last_run_at, stale}` where `stale = now - last_run_at > BACKUP_STALE_HOURS`.
- **Rationale**: Phase 4 already writes a timestamped `SUCCESS`/`FAILED` line on every run path
  (`scripts/backup.sh`); reading it is the lowest-coupling way to surface health with no new state.
- **Details**:
  - **Log format is the contract** (Phase 4 `backup.sh`): lines are
    `[2026-07-26T02:30:00Z] SUCCESS` / `[...] FAILED: <reason>`. The parser reads the file, scans
    from the end for the last line matching that shape, and extracts the bracketed UTC timestamp and
    the `SUCCESS`/`FAILED` keyword.
  - **Staleness**: `BACKUP_STALE_HOURS` (new setting, default 36) — one missed nightly run (24h)
    plus margin. Compared using timezone-aware UTC.
  - **Missing / unreadable / unparseable log → `status: "unknown"`, `stale: false`** — no banner.
    This is the dev default (no backups run locally) and must never raise a false alarm (FR-016).
  - **Banner logic (frontend)**: show the warning banner when `status == "failed"` **or**
    (`status == "success"` **and** `stale == true`); hide it when `status == "success" && !stale`
    or `status == "unknown"`.
  - Endpoint reads the file per request (no caching needed at this scale); tolerates a partial last
    line (mid-write) by falling back to the last *complete* matching line.
- **Alternatives rejected**: A new DB table / status row written by the backup job (adds schema +
  couples the Pi-only shell to the app DB — rejected; the log already exists); systemd journal
  parsing (less portable, needs privileges).

## 5. Error-state completion (frontend)

- **Decision**: Reuse the existing `StateView` (loading/error/retry) and `ApiError` machinery;
  fill the gaps so every data screen has a retryable error state, Claude preserves the conversation
  and typed message on API failure, and failed writes refetch the true state.
- **Rationale**: Phase 2 already introduced `StateView` and `ApiError`; Phase 5 completes coverage
  rather than inventing a new pattern (Constitution — minimum code, no refactor of working code).
- **Details**:
  - **Backend unreachable**: `fetch` rejects (network error) → surfaced as an error state with
    "Try again" within the request timeout. Add a client-side timeout (AbortController) so a dead
    Pi doesn't spin indefinitely (SC-004, ~10s).
  - **Anthropic API down**: `POST /api/claude` already returns 502 on API unavailability (Phase 3).
    The Claude screen shows a friendly error and keeps `conversation` + the input box populated so
    the user retries without retyping (FR-012).
  - **Write failure**: on a rejected create/update/delete (incl. the new 403), show the error and
    re-run the existing month-detail fetch so no optimistic/stale value lingers (FR-013,
    Constitution V "recompute fresh after any write").
- **Alternatives rejected**: A new global error boundary/toast system (larger surface than needed;
  `StateView` + per-action error already fit the screens).

## 6. Config additions

- **Decision**: Add two settings to `backend/config.py`: `backup_log_file: str = ""` (blank ⇒
  status "unknown", dev-safe) and `backup_stale_hours: int = 36`. Both documented in
  `.env.production` and the README. No change to how `app_pin` is loaded (already present).
- **Rationale**: Keeps environment-specific values out of code (Constitution / CLAUDE.md), and lets
  the operator tune staleness without a redeploy (clarified).
- **Alternatives rejected**: Hardcoded log path / threshold (fails the config-driven principle and
  the env-configurable clarification).
