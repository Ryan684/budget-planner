# Feature Specification: Phase 3 — Claude Integration

**Feature Branch**: `003-claude-integration` (Spec Kit branch-per-feature model; merged to `main` via PR when quality gates pass)
**Created**: 2026-06-18
**Status**: Draft
**Input**: `docs/budget-planner-spec.md` (Phase 3 — Claude Integration), `docs/budget-planner.feature`
(Claude — Querying, Claude — Writing, Undo features)

> Describes WHAT and WHY only — implementation detail lives in `plan.md`. Scoped to the in-app
> Claude assistant that lets the family query, analyse, and amend the budget in natural language
> from the Claude screen. The Phase 2 screens, data layer, and amendments log already exist; this
> phase makes the "Ask Claude" entry point functional end-to-end.
>
> **In scope**: conversational querying over the household's full multi-month financial picture
> (all months, account balances and their history), forecasting and scenario modelling, direct
> writes to the active current month under a confirm-then-act pattern, amendment logging of every
> Claude write, and a session-scoped "Undo last Claude change".
>
> **Out of scope**: backup automation (Phase 4), PIN/auth (Phase 5), persistent chat history
> across sessions, push notifications or scheduled summaries, writes to any month other than the
> current one, and any data source beyond the existing budget tables.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask Claude about the budget (Priority: P1)

As a family member on my phone, I open the Claude screen and ask plain-language questions about
our budget — "what's our surplus this month?", "how much is in savings?", "if we save £500 a
month when do we hit £20,000?" — and get fast, correct answers grounded in our real figures,
without Claude ever inventing a number.

**Why this priority**: Querying is the core value of the integration and the safest slice — it is
read-only, so it can ship and deliver value before any write capability exists. It turns the
budget from a static set of screens into something the family can interrogate conversationally.

**Independent Test**: With a month that has complete income, bills, and account balances, open the
Claude screen and ask a surplus question, a savings question, and a forecast question — each answer
matches the underlying data, references only the current month, and cites the as-of date when a
balance is involved.

**Acceptance Scenarios**:

1. **Given** the current month has complete income and bills, **When** I ask "what's our surplus
   this month?", **Then** Claude returns the correct surplus figure for the current month.
2. **Given** account balances are recorded, **When** I ask "how much do we have in savings?",
   **Then** Claude returns the correct savings balance and notes its as-of date.
3. **Given** the current surplus is £600 and total savings is £8,400, **When** I ask "if we save
   £500 a month when do we hit £20,000?", **Then** Claude calculates the correct timeline based on
   the recorded balance, not an invented figure.
4. **Given** a scenario question such as "if the mortgage goes up £150 what happens to our
   surplus?", **When** I ask it, **Then** Claude models the outcome against current data and writes
   nothing to the database.
5. **Given** the current month has no broadband entry, **When** I ask "how much is our broadband
   bill?", **Then** Claude states there is no broadband bill recorded and does not invent or
   approximate a figure.
6. **Given** an account balance recorded 45 days ago, **When** I ask a question that uses it,
   **Then** Claude notes the balance may be out of date and includes its as-of date.
7. **Given** I am in a fresh Claude session, **When** I send a message, **Then** the conversation
   history for that session is retained for follow-up questions and is discarded when the session
   ends (no persistent history across sessions).

---

### User Story 2 - Let Claude make the change for me (Priority: P2)

As a family member, instead of navigating to the right screen and editing fields, I tell Claude
"add a £45 water bill" or "update savings to £8,900" and it makes the change to the live budget in
the same turn — but only after stating exactly what it will do and the effect on surplus or
balances, so any misunderstanding is visible before it happens. Every such change is recorded in
the amendments log as Claude's work.

**Why this priority**: Direct writes are the headline convenience of the integration, but they
depend on querying (P1) being trustworthy first and carry more risk, so they follow it. The
confirm-then-act pattern and amendment logging are what make writes safe enough to ship.

**Independent Test**: From an active current month, ask Claude to add a bill — Claude states the
intended change and its surplus impact, the bill appears in the data in the same turn, an
amendment is logged with source "claude" and a populated reason, and the dashboard figures reflect
the new bill.

**Acceptance Scenarios**:

1. **Given** the current month is active, **When** I ask Claude to "add a £45 water bill", **Then**
   Claude states the intended change and its effect on surplus before executing, the bill is
   written in the same turn, an amendment is logged with source "claude" and an auto-populated
   reason, and the budget figures update to reflect it.
2. **Given** an account "Savings" exists with balance £8,400, **When** I tell Claude "update
   savings to £8,900", **Then** Claude states the intended change, the balance is updated in the
   same turn, and an amendment is logged with source "claude".
3. **Given** a bill "Electricity" exists for £85, **When** I ask Claude to "change electricity to
   £97", **Then** Claude states the intended change and the updated surplus, the bill is updated in
   the same turn, and an amendment is logged with source "claude".
4. **Given** a bill "Boiler service" exists for £120, **When** I ask Claude to "remove the boiler
   service bill", **Then** Claude states the intended deletion and updated surplus, the bill is
   deleted in the same turn, and an amendment is logged with source "claude".
5. **Given** two bills both containing the word "insurance", **When** I ask Claude to "update the
   insurance bill to £50", **Then** Claude asks which insurance bill I mean and makes no write
   until I clarify.
6. **Given** I am viewing a previous month in read-only mode, **When** I attempt to ask Claude to
   make a change, **Then** Claude explains it cannot write to previous months and no write occurs.
7. **Given** any Claude-initiated write, **When** it is recorded in the amendments log, **Then** it
   carries source "claude", the old and new values, and a human-readable reason describing what
   changed and why.

---

### User Story 3 - Undo Claude's last change (Priority: P3)

As a family member, if Claude makes a change I didn't want, I tap "Undo last Claude change" and the
most recent Claude write is reverted and the figures snap back — without touching any edits I made
by hand. The undo control is only present when there is a Claude change in the current session to
revert.

**Why this priority**: Undo is the safety net that makes writing (P2) comfortable to use, but it is
only meaningful once writes exist, so it comes last. It is session-scoped and reverts Claude work
only.

**Independent Test**: After Claude adds a £120 bill in the session, tap "Undo last Claude change" —
the bill is removed, figures revert to their pre-change state, and the button becomes inactive;
repeating with multiple Claude writes reverts only the most recent.

**Acceptance Scenarios**:

1. **Given** Claude has added a £120 bill in the current session, **When** I tap "Undo last Claude
   change", **Then** the bill is removed, the budget figures revert to their pre-change state, and
   the undo control disappears or becomes inactive.
2. **Given** I have just opened the Claude screen and Claude has made no writes this session,
   **When** I look for the undo control, **Then** it is not visible or is inactive.
3. **Given** I have manually edited a bill and Claude has also made a write, **When** I tap "Undo
   last Claude change", **Then** only the Claude write is reverted and my manual edit is unchanged.
4. **Given** Claude has made three writes in the current session, **When** I tap "Undo last Claude
   change", **Then** only the most recent Claude write is reverted and the two earlier ones remain.

---

### User Story 4 - Compare and spot trends across months (Priority: P3)

As a family member, I ask Claude "how does this month compare to last month?" or "how's our
surplus trending this year?" and it answers from the full history it already has — clear
comparisons and trends across months — and if there is no prior month yet, it tells me so plainly
rather than erroring.

**Why this priority**: Cross-month comparison and trend analysis are valuable but secondary to
single-month querying, so they sit at P3 as an enhancement to the querying core. Because Claude
already receives the full multi-month picture (per the privacy boundary below), no special
per-question fetch is needed.

**Independent Test**: With several months of complete data, ask for a comparison and a trend —
Claude contrasts income, bills, and surplus across the relevant months and describes the trend;
with only one month present, a comparison question yields a graceful "no previous month" answer
and no error.

**Acceptance Scenarios**:

1. **Given** at least two months exist with complete data, **When** I ask "how does this month
   compare to last month?", **Then** Claude provides a clear comparison of income, bills, and
   surplus across those months.
2. **Given** several months of data exist, **When** I ask about a trend (e.g. "how's our surplus
   trending?"), **Then** Claude describes the trend using the recorded figures across months,
   without inventing data.
3. **Given** only the current month exists, **When** I ask a comparison question, **Then** Claude
   explains there is no previous month to compare against and does not error or return empty data.

---

### Edge Cases

- **Assistant unavailable**: When the AI service is unreachable or times out, the user sees a clear
  error on the Claude screen and no partial write is recorded; the budget is left unchanged.
- **Write fails mid-turn**: If a stated change cannot be applied (e.g. the target was deleted
  between statement and execution), Claude reports the failure, the data is left unchanged, and no
  amendment is logged.
- **Ambiguous target with no match**: If the user references an item that does not exist, Claude
  says so and makes no write (rather than creating a new item silently).
- **Undo with nothing to undo**: Invoking undo when no Claude write exists in the session is a
  no-op with the control inactive.
- **Undo after manual edit on the same item**: Reverting a Claude write restores that write's
  pre-change value; the spec assumes the most recent Claude amendment is the unit of undo (see
  Assumptions).
- **Negative or implausible figures**: A request that would produce a negative bill/income amount
  is surfaced for confirmation rather than written blindly; surplus may legitimately go negative
  and is reported in red per the existing UI rules.
- **Long or multi-step requests**: If one message asks for several writes, Claude states each
  intended change; partial application is avoided where a later step is ambiguous.

## Requirements *(mandatory)*

### Functional Requirements

#### Conversation & querying

- **FR-001**: The system MUST provide a chat-style Claude screen where the user can send a message
  and receive a response grounded in the current month's budget.
- **FR-002**: Claude MUST be able to read every month's income entries, bills, and monthly
  surplus, all account balances (with as-of dates) and their historical changes, and the
  amendments log when answering — the household's full financial picture.
- **FR-003**: Claude MUST answer budget questions, savings forecasts, and scenario models using
  only figures present in the data, and MUST NOT invent or approximate figures that are not
  recorded.
- **FR-004**: When a question concerns an item not present in the data, Claude MUST state that no
  such record exists rather than estimating a value.
- **FR-005**: When an answer relies on an account balance, Claude MUST include that balance's
  as-of date, and MUST flag when the balance is stale (recorded 30 or more days ago).
- **FR-006**: Scenario/"what if" questions MUST be answered without writing to the database unless
  the user explicitly asks for the change to be made.
- **FR-007**: The session MUST retain conversation history for follow-up questions within that
  session and MUST discard it when the session ends (no cross-session persistence in MVP).

#### Writing (confirm-then-act)

- **FR-008**: Claude MUST be able to add, edit, and delete income entries and bills, and update
  account balances, for the active current month.
- **FR-009**: Before executing any write, Claude MUST state the intended change and its effect on
  monthly surplus or account balances in the same response.
- **FR-010**: For an unambiguous request, the stated change and its execution MUST occur in the
  same turn (no separate confirmation round-trip required).
- **FR-011**: When a request is ambiguous (e.g. multiple matching bills), Claude MUST ask for
  clarification and MUST NOT write until the user disambiguates.
- **FR-012**: Every Claude-initiated write MUST record an amendment with source "claude", the
  field changed, the old and new values, and a populated human-readable reason.
- **FR-013**: After any write, the response MUST reflect the recalculated budget figures, and the
  app's screens MUST show the updated figures (no stale client-side totals).
- **FR-014**: Claude MUST NOT write to any month other than the active current month; attempts to
  change a previous (read-only) month MUST be refused with an explanation and MUST NOT alter data.
- **FR-015**: A failed or refused write MUST leave the budget unchanged and MUST NOT create an
  amendment record.

#### Undo

- **FR-016**: The Claude screen MUST present an "Undo last Claude change" control whenever at least
  one Claude write has occurred in the current session, and MUST hide or disable it otherwise.
- **FR-017**: Invoking undo MUST revert the single most recent Claude-initiated write and restore
  the affected figures to their pre-change state.
- **FR-018**: Undo MUST never revert a manual user edit; it acts only on writes tagged source
  "claude".
- **FR-019**: Undo scope MUST be the current session only and MUST reset when the Claude screen is
  closed.

#### Cross-month context

- **FR-020**: The system MUST make every month's budget (income, bills, surplus) and the full
  account-balance history available to Claude for reading, analysis, and forecasting.
- **FR-021**: A comparison or trend request with no prior month available MUST yield a plain
  explanation and MUST NOT error or return empty data.

#### Privacy boundary

- **FR-022**: Each Claude request MUST send only the household's structured financial data — all
  months' budgets, all account balances and their history, the amendments log, the user's message,
  and the session conversation — and MUST NOT send the raw database file, application secrets,
  `.env`, or the PIN.

### Key Entities *(include if feature involves data)*

- **Conversation session**: An in-memory, session-scoped exchange of user and Claude messages on
  the Claude screen. Holds the running dialogue and the list of Claude writes made this session
  (the basis for undo). Not persisted across sessions.
- **Budget context**: The structured snapshot sent to Claude for a request — every month's income,
  bills, and surplus, all account balances with as-of dates and their historical changes, and the
  amendments log. The privacy boundary's payload (excludes the raw database file, secrets, and PIN).
- **Claude write / amendment**: A change made by Claude to an income entry, bill, or account
  balance, recorded in the existing amendments log with source "claude", old/new values, and a
  reason. The unit that undo reverts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a set of representative budget questions (surplus, savings balance, savings
  forecast, scenario model) against known data, 100% of Claude answers match the figures derived
  from that data, with zero invented numbers.
- **SC-002**: Every Claude write in testing produces exactly one amendment tagged source "claude"
  with a non-empty reason and correct old/new values — no Claude write is ever missing from the
  log.
- **SC-003**: Before every Claude write, the user sees a statement of the intended change and its
  surplus/balance effect in the same response — 100% of write turns include this statement.
- **SC-004**: "Undo last Claude change" reverts only the most recent Claude write and leaves all
  manual edits and earlier Claude writes intact in 100% of tested undo scenarios.
- **SC-005**: No Claude request in testing transmits data beyond the defined boundary — the
  structured financial data (all months, balances and history, amendments, session conversation)
  is expected; the raw database file, application secrets, `.env`, and the PIN are never sent.
- **SC-006**: Claude never writes to a previous (read-only) month in any tested attempt.
- **SC-007**: A typical query returns a usable answer quickly enough to feel conversational on a
  phone (target: first response within a few seconds under normal conditions), and a failed
  assistant call shows a clear error without corrupting budget data.

## Assumptions

- **Phases 1–2 are complete**: The data layer (months, income, bills, accounts, amendments,
  carry-forward, budget calculations) and the Phase 2 UI exist and are the foundation this phase
  builds on; the Claude screen and its "Ask Claude" entry point are wired but non-functional until
  this phase.
- **Single shared access**: No per-user identity in MVP, so the conversation and undo are scoped to
  a single shared session rather than to an individual user.
- **Undo granularity is one amendment**: "Undo last Claude change" reverts the single most recent
  Claude amendment. Multi-step writes within one turn that need atomic group-undo are not required
  by the feature file and are out of scope unless raised later.
- **Confirm-then-act is single-turn for unambiguous requests**: The feature file shows Claude
  stating the change and executing in the same turn; an explicit second user confirmation is only
  required when the request is ambiguous. "Confirm" here means Claude makes its intent visible, not
  that it blocks on a yes/no for every write.
- **Full-history reads, current-month writes**: Claude receives the household's full multi-month
  financial picture for analysis and forecasting (widened from the original "current month + one
  named prior month" boundary on 2026-06-18 — see constitution Principle IV v1.1.0). The read-only
  rule constrains writes only: Claude still cannot write to any month but the active current one.
- **Stale threshold reuses Phase 2's 30-day rule**: A balance is "stale" at ≥30 days, matching the
  dashboard's existing staleness treatment.
- **The runtime model is `claude-sonnet-4-6`**: Per the project constitution and spec, the in-app
  assistant uses Sonnet, not Opus, for cost efficiency; model selection is an implementation
  concern recorded here for traceability.
- **Standard error handling**: Assistant outages or write failures surface a friendly error and
  leave data untouched; no automatic retries are assumed beyond what the platform provides.
