# Implementation Plan: Phase 3 — Claude Integration

**Branch**: `003-claude-integration` (Spec Kit branch-per-feature model; merged to `main` via PR when quality gates pass) | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-claude-integration/spec.md`

## Summary

Make the existing "Ask Claude" screen functional end-to-end. A new `/api/claude` backend
endpoint sends the household's full multi-month financial picture (all months' income/bills/surplus,
all account balances, the new balance-snapshot history, and the amendments log) plus the session
conversation to `claude-sonnet-4-6`, which answers questions and — for the active current month only —
adds/edits/deletes income and bills and updates account balances via **tool calls**. Writes reuse the
existing `crud.py` amendment-logging helpers with `source="claude"`. A new `account_balance_snapshots`
table (FR-023) records an append-only row on every balance update so Claude has a reliable balance
time series. The frontend Claude screen holds the conversation and the session's Claude-write list in
React state (session-scoped), renders a single complete response per turn (no streaming, per
clarification), and offers "Undo last Claude change" that reverts the most recent Claude *turn* as one
unit. The technical approach: official `anthropic` Python SDK, a **manual tool-use loop** in the
backend (so we can enforce current-month-only writes, atomic per-turn rollback, and amendment logging
around each tool call), `messages.count_tokens()` to trim the oldest conversation turns when the
payload would exceed context, and the SDK's typed exceptions for the "assistant unavailable" edge case.

## Technical Context

**Language/Version**: Python 3.14 (backend), TypeScript 5.x / React 19 (frontend) — matches Phases 1–2.

**Primary Dependencies**:
- Backend (existing): FastAPI, SQLAlchemy 2, Pydantic v2, pydantic-settings, uvicorn.
- Backend (**new, confirmed**): `anthropic` — official Python SDK — added to `[project.dependencies]`
  in `backend/pyproject.toml`. This is the only new runtime dependency.
- Frontend (existing): React 19, Vite. **No new npm packages** — the chat UI is built from existing
  components and `fetch` via the current `api/client.ts`.

**Storage**: SQLite (existing `models.py`). One new table `account_balance_snapshots`. No migration
framework — manual schema addition via `Base.metadata.create_all` on startup (greenfield dev DB) plus
a documented migration note for any existing DB.

**Testing**: pytest + httpx (backend), Vitest + Testing Library (frontend), mutmut (backend mutation),
Stryker (frontend mutation). The Anthropic API is **mocked in all tests** — no live API calls in CI.

**Target Platform**: Raspberry Pi 5 (prod), localhost (dev). Phone browser (mobile-first).

**Project Type**: Web application (FastAPI backend + React/Vite frontend) — existing structure.

**Performance Goals**: SC-007 — a typical query feels conversational on a phone (first response within
a few seconds under normal conditions). Model is `claude-sonnet-4-6` for cost efficiency.

**Constraints**:
- Privacy boundary (FR-022 / Constitution IV): send only structured financial JSON + the user message
  + session conversation; never the raw DB file, secrets, `.env`, or the PIN.
- Writes confined to the active current (latest) month; previous months read-only (FR-014).
- `amendments` table append-only; `source` ∈ {"user","claude"} (Constitution V).
- One-shot (non-streaming) responses (clarification 2026-06-20).
- Atomic per-turn writes: any failure in a multi-write turn rolls the whole turn back (FR-015).
- Per-turn undo granularity (FR-017).

**Scale/Scope**: Family of two; a handful of months of data; single shared session at a time. Payload
is small relative to the 1M-token `claude-sonnet-4-6` context window; trimming is a safety net only.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Compliance in this plan |
|---|---|
| **I. Spec-First, Test-First** | Gherkin already exists (`docs/budget-planner.feature` — Claude Querying/Writing/Undo). `/speckit-tasks` will order failing tests before implementation. Clarifications resolved 2026-06-20. ✅ |
| **II. Quality Gates** | ruff + ruff format (backend), ESLint + tsc (frontend), pytest/Vitest, mutmut/Stryker. New backend logic (tool dispatch, atomic rollback, snapshot write, context trim) added to `[tool.mutmut] paths_to_mutate`. ✅ |
| **III. Typed, Schema-Driven, ORM-Only** | Pydantic schemas for all `/api/claude` request/response models; SQLAlchemy ORM for the snapshot table (no raw SQL); TypeScript throughout (no `any`); CSS modules for the chat UI; money as `£X,XXX.XX`, negatives red. ✅ |
| **IV. Privacy & AI Data Boundary** | Claude called only from `/api/claude`. Payload = structured financial JSON + message + session conversation; excludes DB file/secrets/`.env`/PIN. Every write tagged `source:"claude"` with a `reason`, states effect before executing, returns recalculated figures. Writes current-month-only. ✅ |
| **V. Data Durability & Integrity** | Money as REAL float; UTC timestamps; `amendments` append-only (undo writes a *new* reversing amendment — see research.md, it does not delete rows); `source` constrained; figures recomputed fresh from `budget.py` after every write. ✅ |

**Result: PASS.** No violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/003-claude-integration/
├── plan.md              # This file (/speckit-plan output)
├── spec.md              # Feature spec (+ 2026-06-20 clarifications)
├── research.md          # Phase 0 output (this run)
├── data-model.md        # Phase 1 output (this run)
├── quickstart.md        # Phase 1 output (this run)
├── contracts/
│   └── claude-api.md    # Phase 1 output — /api/claude endpoint contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

Extends the existing Phase 1–2 layout. **New files marked `(new)`; modified marked `(mod)`.**

```text
backend/
├── models.py                         # (mod) add AccountBalanceSnapshot
├── schemas.py                        # (mod) add Claude request/response + snapshot schemas
├── crud.py                           # (mod) write a snapshot row inside the account-balance update path
├── budget.py                         # (unchanged) reused for recalculated figures
├── claude_context.py                 # (new) build the privacy-bounded financial JSON payload
├── claude_tools.py                   # (new) tool definitions + dispatch to crud (current-month-only, atomic)
├── claude_client.py                  # (new) anthropic SDK wrapper: system prompt, manual tool loop, count_tokens trim, error mapping
├── main.py                           # (mod) include the claude router
└── routers/
    └── claude.py                     # (new) POST /api/claude (+ undo endpoint)

backend/tests/
├── test_claude_context.py            # (new) payload contents + privacy-boundary exclusions
├── test_claude_tools.py              # (new) tool dispatch, current-month guard, atomic rollback, amendment logging
├── test_claude_api.py                # (new) endpoint happy paths + error cases (Anthropic mocked)
├── test_account_snapshots.py         # (new) snapshot written on every balance update
└── factories.py                      # (mod) snapshot/conversation helpers if needed

frontend/src/
├── screens/
│   ├── Claude.tsx                    # (mod) replace placeholder with chat UI + undo control
│   └── __tests__/Claude.test.tsx     # (new) querying render, write confirmation, undo visibility/behavior
├── api/
│   ├── claude.ts                     # (new) postClaudeMessage / undoLastClaudeChange client fns
│   └── types.ts                      # (mod) Claude request/response + snapshot types
└── hooks/
    └── useClaudeSession.ts           # (new) session conversation + Claude-write list state, undo logic
```

**Structure Decision**: Web-application layout (Option 2), already established by Phases 1–2. Phase 3
adds three focused backend modules (`claude_context`, `claude_tools`, `claude_client`) plus a router,
keeping the Anthropic-specific code isolated from the existing data layer; the data layer is touched
only to add the snapshot table and the snapshot write in the existing account-update path. The frontend
adds one hook and one API client module and fills in the existing `Claude.tsx` placeholder — no new
components or packages required.

## Complexity Tracking

No constitution violations — section intentionally empty.
