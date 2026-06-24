# Quickstart: Phase 3 — Claude Integration

How to set up, run, and validate the Claude integration in local development. Assumes Phases 1–2 are
working (data layer + UI). The Anthropic API is **mocked in tests**; a real key is only needed to use
the live Claude screen in the browser.

## 1. Install the new dependency

The only new runtime dependency is the official `anthropic` SDK (added to
`backend/pyproject.toml` `[project.dependencies]`).

```bash
cd backend
pip install -e ".[dev]"        # picks up the newly-added anthropic dependency
```

No new npm packages — the frontend chat UI uses existing components and `fetch`.

## 2. Configure the API key (dev)

Add your key to `.env.local` (gitignored — never commit it). `config.py` reads it via
pydantic-settings:

```
ANTHROPIC_API_KEY=sk-ant-...
```

`Settings` in `backend/config.py` gains an `anthropic_api_key: str = ""` field. The Anthropic client is
constructed from it. With the key blank, `/api/claude` returns the friendly 502 "assistant unavailable"
error — the rest of the app still runs.

## 3. Apply the schema change

The new `account_balance_snapshots` table is created automatically on backend startup via
`Base.metadata.create_all` (dev DB). If you have an existing dev DB you want to keep, create the table
manually (see data-model.md §1) and optionally backfill one snapshot per existing account.

## 4. Run the app

```bash
# terminal 1 — backend
cd backend && uvicorn main:app --reload --port 8000

# terminal 2 — frontend
cd frontend && npm run dev
```

Open `http://localhost:5173`, ensure a current month with income, bills, and at least one account
balance exists, then open the **Claude** tab.

## 5. Manual validation (maps to acceptance scenarios)

With a current month populated:

| Try | Expect | Scenario |
|---|---|---|
| "what's our surplus this month?" | Correct surplus from the data; no write | US1 #1, FR-003 |
| "how much is in savings?" | Correct savings balance + its as-of date | US1 #2, FR-005 |
| "if we save £500/month when do we hit £20,000?" | Timeline computed from the recorded balance | US1 #3 |
| "how much is our broadband bill?" (none exists) | "no broadband bill recorded" — no invented figure | US1 #5, FR-004 |
| "add a £45 water bill" | States intent + surplus effect, writes it, figures update | US2 #1, FR-009/010/013 |
| "update savings to £8,900" | States intent, balance updated, snapshot row written | US2 #2 |
| "update the insurance bill to £50" (two match) | Asks which one; no write until you clarify | US2 #5, FR-011 |
| Tap **Undo last Claude change** after a write | Write reverted, figures snap back, control hides if no writes remain | US3, FR-016/017 |
| Make 3 Claude writes in one session, undo once | Only the most recent **turn** reverts; earlier turns remain | US3 #4 |
| Manually edit a bill, then Claude writes, then undo | Only the Claude write reverts; your edit is untouched | US3 #3, FR-018 |
| View a previous month, ask Claude to change something | Claude explains it can't write to previous months; nothing changes | US2 #6, FR-014 |
| "how does this month compare to last month?" | Clear comparison across months (or "no previous month" if only one) | US4 |

## 6. Run the quality gates

Per the constitution build order — both linters, then tests, then mutation, before commit.

```bash
# backend
cd backend
ruff check .
ruff format --check .
pytest

# frontend
cd frontend
npm run lint
npx tsc --noEmit
npm run test
```

Mutation testing (after implementation): `mutmut run` (backend — the new context-building, tool-dispatch,
atomic-rollback, snapshot-write, and context-trim logic is in `[tool.mutmut] paths_to_mutate`) and
`npm run test:mutation` (frontend). Record any accepted surviving mutants in `MUTANTS.md`.

## 7. What's mocked in tests

- **Backend**: the Anthropic client is replaced with a fake that returns scripted `messages.create`
  results (text-only turns, single-tool turns, multi-tool turns, refusals, and raised exceptions). No
  network calls in CI. `count_tokens` is mocked to drive the context-trim path deterministically.
- **Frontend**: `api/claude.ts` is mocked so `Claude.test.tsx` exercises rendering, the write-confirmation
  display, and undo visibility/behavior without a backend.

## 8. Privacy-boundary check (SC-005)

`test_claude_context.py` asserts the exact payload handed to the (mocked) Anthropic client contains the
structured financial data **and excludes** the raw DB file, secrets, `.env`, and the PIN. Treat a
failure here as release-blocking — it is the core safety property of the feature.
