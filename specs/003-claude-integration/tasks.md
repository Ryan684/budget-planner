---

description: "Task list for Phase 3 — Claude Integration"
---

# Tasks: Phase 3 — Claude Integration

**Input**: Design documents from `/specs/003-claude-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/claude-api.md, quickstart.md

**Tests**: REQUIRED. The project constitution (Principle I, NON-NEGOTIABLE) and `CLAUDE.md` build order
mandate test-first: Gherkin → failing tests → minimum code. The Gherkin acceptance scenarios already
exist in `docs/budget-planner.feature` (Claude — Querying / Claude — Writing / Undo / Amendments Log) —
read the relevant scenarios before writing each test. Every story phase writes failing tests before
implementation.

**Organization**: Tasks are grouped by user story. US1 is the MVP. Because the whole feature funnels
through one `/api/claude` path, US2–US4 build on the US1 query/client infrastructure (noted in
Dependencies) — they remain independently *testable* but are layered, not fully parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4 (user-story phases only; Setup/Foundational/Polish carry no story label)
- All paths are repo-relative (web app: `backend/`, `frontend/src/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the one new dependency and wire configuration/tooling.

- [X] T001 Add `anthropic` to `[project.dependencies]` in `backend/pyproject.toml`, then run `pip install -e ".[dev]"` to install it
- [X] T002 [P] Add `anthropic_api_key: str = ""` to `Settings` in `backend/config.py` and document `ANTHROPIC_API_KEY` in `.env.local` (gitignored — do not commit a key)
- [X] T003 [P] Register new modules (`claude_context`, `claude_tools`, `claude_client`) in `[tool.setuptools] py-modules` and add them to `[tool.mutmut] paths_to_mutate` in `backend/pyproject.toml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data-layer schema change and the cross-cutting scaffolding every story needs. No Claude
reasoning yet.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T004 [P] Add the `AccountBalanceSnapshot` model (append-only: `id`, `account_id` indexed, `balance`, `as_of_date`, `recorded_at` UTC) to `backend/models.py` per data-model.md §1
- [X] T005 [P] Add Pydantic schemas to `backend/schemas.py`: `AccountBalanceSnapshotRead`, and the Claude contract schemas `ClaudeMessage`, `ClaudeRequest`, `ClaudeWrite`, `ClaudeResponse`, `ClaudeUndoRequest`, `ClaudeUndoResponse` per contracts/claude-api.md
- [X] T006 Write failing test `backend/tests/test_account_snapshots.py` asserting one snapshot row is written on every account-balance **create and update** (FR-023)
- [X] T007 Implement the snapshot write inside the account-balance create/update path in `backend/crud.py` and `backend/routers/accounts.py` so T006 passes (depends on T004, T006)
- [X] T008 [P] Create `backend/routers/claude.py` with router prefix `/api/claude` and a stub `POST` handler; include the router in `backend/main.py`
- [X] T009 [P] Create `frontend/src/api/claude.ts` (`postClaudeMessage`, `undoLastClaudeChange`) and add Claude request/response + snapshot types to `frontend/src/api/types.ts`
- [X] T010 [P] Create `frontend/src/hooks/useClaudeSession.ts` holding session conversation `messages` and per-turn `claudeWrites` state (session-scoped; resets when the screen unmounts) per data-model.md §4
- [X] T011 Replace the placeholder in `frontend/src/screens/Claude.tsx` with a chat shell (message list + input + send), wired to `useClaudeSession` and `api/claude.ts` (depends on T009, T010)

**Checkpoint**: Schema, scaffolding, and chat shell exist; no Claude calls succeed yet.

---

## Phase 3: User Story 1 - Ask Claude about the budget (Priority: P1) 🎯 MVP

**Goal**: Open the Claude screen, ask plain-language budget/savings/forecast/scenario questions, and get
fast, correct answers grounded in the real figures — never an invented number; read-only.

**Independent Test**: With a current month that has income, bills, and account balances, ask a surplus
question, a savings question, and a forecast question — each answer matches the data, cites the as-of
date when a balance is used, and writes nothing.

### Tests for User Story 1 ⚠️ (write first, ensure they FAIL)

- [X] T012 [P] [US1] Failing `backend/tests/test_claude_context.py`: payload includes every month's income/bills/surplus, accounts with `as_of_date` + `is_stale` (≥30 days), `balance_snapshots`, and amendments; and **excludes** the raw DB file, secrets, `.env`, and the PIN (FR-002, FR-022, SC-005)
- [X] T013 [P] [US1] Failing query cases in `backend/tests/test_claude_api.py` with a **mocked** Anthropic client: correct surplus; savings balance + as-of date; **a ≥30-day-old balance is flagged as possibly out of date** (FR-005, US1 #6); forecast from the recorded balance; "no broadband bill recorded" (no invented figure); scenario question writes nothing; conversation retained within the session; **a long conversation trims the oldest turns to fit context while the financial context is never trimmed** (context-overflow edge case); **a raised SDK exception (e.g. `APIConnectionError`/timeout) yields a friendly 502 with no amendment written and the budget unchanged** (SC-007, "Assistant unavailable" edge case) (FR-003/004/005/006/007)
- [X] T014 [P] [US1] Failing render cases in `frontend/src/screens/__tests__/Claude.test.tsx` (mocked `api/claude.ts`): a user message and the grounded assistant reply are displayed; loading and error states render

### Implementation for User Story 1

- [X] T015 [US1] Implement `backend/claude_context.py`: build the privacy-bounded payload from `budget.py` + ORM (all months, accounts with `is_stale`, snapshots, amendments), deterministic key order — makes T012 pass
- [X] T016 [US1] Implement `backend/claude_client.py` base: construct the Anthropic client from `config`, the system prompt (grounding rules from CLAUDE.md), a non-tool `messages.create` call to `claude-sonnet-4-6`, `count_tokens`-based trimming of oldest conversation turns (financial context never trimmed), and mapping of SDK exceptions / `refusal` stop reason to a domain error (FR-003/004/007; overflow + assistant-unavailable edge cases)
- [X] T017 [US1] Implement the `POST /api/claude` query path in `backend/routers/claude.py`: validate request, build context, call the client, return `reply` + recalculated `summary` (`budget.py`) + `writes: []`; map client errors to `502` — makes T013 pass
- [X] T018 [US1] Render assistant replies, loading, and error states in `frontend/src/screens/Claude.tsx`, keeping the running conversation in `useClaudeSession` — makes T014 pass

**Checkpoint**: MVP — querying works end-to-end and is independently demoable.

---

## Phase 4: User Story 2 - Let Claude make the change for me (Priority: P2)

**Goal**: Tell Claude "add a £45 water bill" / "update savings to £8,900"; it states the intended change
and its surplus/balance effect, applies it to the current month in the same turn, logs an amendment with
`source:"claude"`, and the figures update. Multi-write turns are atomic.

**Independent Test**: From an active current month, ask Claude to add a bill — it states intent + surplus
effect, the bill appears in the same turn, an amendment is logged with `source:"claude"` and a populated
reason, and the dashboard figures reflect it.

### Tests for User Story 2 ⚠️ (write first, ensure they FAIL)

- [X] T019 [P] [US2] Failing `backend/tests/test_claude_tools.py`: each tool dispatches to `crud` with `source="claude"` + `reason`; current-month-only guard; ambiguous/not-found target → tool error; a multi-write turn where one write fails rolls the whole turn back (budget unchanged, no amendments); a negative amount is surfaced for confirmation, not written (FR-008/011/012/014/015)
- [X] T020 [P] [US2] Failing write cases added to `backend/tests/test_claude_api.py` (mocked Anthropic): add £45 water bill (states intent+effect, writes, logs `source="claude"`, figures update); update savings (snapshot written); **updating a stale (≥30-day) balance → the pre-write statement includes the staleness flag + as-of date** (FR-009, clarified 2026-06-20); edit electricity to £97; delete boiler service; previous-month write refused with no data change (FR-009/010/013/014)
- [X] T021 [P] [US2] Failing write-confirmation case in `frontend/src/screens/__tests__/Claude.test.tsx`: reply shows the intended change + surplus effect and the refreshed figures surface

### Implementation for User Story 2

- [X] T022 [US2] Add a transaction-scoped write variant to `backend/crud.py` (parameterize commit / support savepoints) so multiple Claude writes in one turn share one transaction (research.md §5)
- [X] T023 [US2] Implement `backend/claude_tools.py`: tool JSON schemas (`add_bill`/`update_bill`/`delete_bill`/`add_income`/`update_income`/`delete_income`/`update_account_balance` — each with a required `reason`, **no `month_id`**) and dispatch to the transactional `crud` variant, with the current month resolved via `routers/deps.latest_month_id` — makes T019 pass (FR-008/011/012/014)
- [X] T024 [US2] Extend `backend/claude_client.py` to the manual tool-use loop: pass `tools`, loop while `stop_reason == "tool_use"` executing via `claude_tools` and feeding `tool_result` back, cap iterations, and roll the whole turn back on any tool failure. Extend the system prompt so that when a write targets a stale (≥30-day) balance, Claude includes the staleness flag + as-of date in its pre-write statement (FR-009, clarified 2026-06-20) — makes the stale-on-write case in T020 pass
- [X] T025 [US2] Extend `POST /api/claude` in `backend/routers/claude.py` to return `writes[]` (amendment ids, old/new, reason) and the recalculated `summary`; return `409` with rollback on a mid-turn write failure — makes T020 pass (FR-013/015)
- [X] T026 [US2] In `frontend/src/screens/Claude.tsx` + `frontend/src/hooks/useClaudeSession.ts`, display the write confirmation, refresh figures, and record the turn's writes in `claudeWrites` — makes T021 pass

**Checkpoint**: US1 + US2 both work; Claude can answer and safely write to the current month.

---

## Phase 5: User Story 3 - Undo Claude's last change (Priority: P3)

**Goal**: Tap "Undo last Claude change" to revert the most recent Claude **turn** as one unit; figures
snap back; manual edits and earlier Claude turns are untouched; the control is present only when there is
a Claude change this session.

**Independent Test**: After Claude adds a £120 bill, tap undo — the bill is removed, figures revert, and
the control deactivates; with three Claude turns, undo reverts only the most recent.

### Tests for User Story 3 ⚠️ (write first, ensure they FAIL)

- [X] T027 [P] [US3] Failing undo cases in `backend/tests/test_claude_api.py`: undo reverts the most recent Claude turn (figures snap back); only `source="claude"` amendments are touched, manual edits untouched (FR-018); three turns → only the latest reverts (FR-017, per-turn); reversal is logged as **new** `source="claude"` amendments (append-only — no rows deleted)
- [X] T028 [P] [US3] Failing undo UI cases in `frontend/src/screens/__tests__/Claude.test.tsx`: control hidden/inactive when no Claude writes; visible after a write; tapping reverts and hides it when none remain (FR-016/019)

### Implementation for User Story 3

- [X] T029 [US3] Implement `POST /api/claude/undo` in `backend/routers/claude.py` (+ helper): reverse the named amendments newest-first in one transaction, `source="claude"` only, inverse ops (delete created / re-create deleted / restore old value), append reversing amendments, return `reverted` + `summary` — makes T027 pass (FR-017/018)
- [X] T030 [US3] Add the "Undo last Claude change" control to `frontend/src/screens/Claude.tsx` (shown only when `claudeWrites` is non-empty), wired to `undoLastClaudeChange` in `useClaudeSession`, popping the latest turn and refreshing figures — makes T028 pass (FR-016/019)

**Checkpoint**: US1–US3 all work; writing is now safe to use with a one-tap undo.

---

## Phase 6: User Story 4 - Compare and spot trends across months (Priority: P3)

**Goal**: Ask "how does this month compare to last month?" or "how's our surplus trending?" and get clear
cross-month comparisons/trends from the full history already in the payload; with only one month, a
graceful "no previous month" answer rather than an error.

**Independent Test**: With several months, ask for a comparison and a trend — Claude contrasts
income/bills/surplus and describes the trend; with one month, a comparison yields a plain "no previous
month" answer and no error.

### Tests for User Story 4 ⚠️ (write first, ensure they FAIL)

- [X] T031 [P] [US4] Failing cases in `backend/tests/test_claude_api.py`: with ≥2 months a comparison contrasts income/bills/surplus; a trend question is described from recorded figures; with only one month, a graceful "no previous month" answer (no error, no empty data) (FR-020/021)

### Implementation for User Story 4

- [X] T032 [US4] Add comparison/trend guidance and "no prior month" handling to the system prompt in `backend/claude_client.py`, and confirm the context payload already carries all months + snapshots (no per-question fetch needed) — makes T031 pass (FR-020/021)

**Checkpoint**: All four user stories function independently.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and session handoff per the constitution build order.

- [ ] T033 [P] Run `mutmut run` (backend); review survivors in `budget.py`/`carry_forward.py`/`crud.py`/`claude_context.py`/`claude_tools.py`/`claude_client.py`; record any accepted survivors in `MUTANTS.md` with id/what/why
- [ ] T034 [P] Run `npm run test:mutation` (frontend Stryker); record any accepted survivors in `MUTANTS.md`
- [X] T035 Run both linters and fix all findings: `cd backend && ruff check . && ruff format --check .`; `cd frontend && npm run lint && npx tsc --noEmit`
- [ ] T036 Run the `quickstart.md` manual validation against a populated current month (all scenario rows)
- [X] T037 Update `docs/progress-log.md`: mark Phase 3 status, list files created/modified, record decisions (snapshot table, transactional `crud` variant, per-turn undo, non-streaming responses) and any spec divergences, and write the exact next step

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup — **blocks all user stories**.
- **US1 (Phase 3)**: depends on Foundational. This is the MVP.
- **US2 (Phase 4)**: depends on US1 — extends `claude_client.py`, the `/api/claude` handler, and the chat UI built in US1 (the feature funnels through one endpoint).
- **US3 (Phase 5)**: depends on US2 — there must be Claude writes to undo.
- **US4 (Phase 6)**: depends on US1's context/client infra; independent of US2/US3 (read-only). Could be built right after US1 if preferred.
- **Polish (Phase 7)**: depends on all targeted stories being complete.

### Within Each Story

- Tests are written first and must FAIL before implementation (Constitution I).
- Backend: model/schemas → context/tools → client → router. Frontend: api client/hook → screen.

### Parallel Opportunities

- Setup: T002, T003 in parallel after T001.
- Foundational: T004, T005, T008, T009, T010 in parallel; T006 before T007; T011 after T009+T010.
- Per story, all `[P]` test tasks run in parallel before that story's implementation.
- Backend and frontend test/impl pairs touch different files and can proceed concurrently within a story.

---

## Parallel Example: User Story 1

```bash
# Write all US1 failing tests together (different files):
Task: "test_claude_context.py — payload contents + privacy-boundary exclusions"
Task: "test_claude_api.py — query happy paths with mocked Anthropic client"
Task: "Claude.test.tsx — render of user message + grounded reply"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP and validate** querying against
real data → demo. Querying is read-only and the safest, highest-value slice.

### Incremental Delivery

US1 (query) → US2 (write, behind confirm-then-act) → US3 (undo safety net) → US4 (cross-month trends).
Each adds value without breaking the previous; stop at any checkpoint to validate.

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- The Anthropic API is **mocked in all automated tests** — no live calls in CI; a real key is only for
  manual browser validation (quickstart.md).
- Privacy-boundary tests (T012) are release-blocking — they guard the core safety property (SC-005).
- `account_balance_snapshots` does not yet exist in `models.py`; T004 creates it (FR-023).
- Commit one logical change per task or logical group; run linters before each commit.
