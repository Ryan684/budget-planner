# CLAUDE.md — Family Budget Planner

## Project Overview

A private, self-hosted monthly budget planning app for a family of two adults. Runs on a Raspberry Pi 5, accessed from phones via browser. Not a spending tracker — a monthly budget planner. The model is: income minus fixed bills equals the monthly surplus.

Claude is integrated via the Anthropic API for natural language querying, analysis, and direct database writes.

**Full spec:** `docs/budget-planner-spec.md`
**Feature files:** `docs/budget-planner.feature`
**UI mockup reference:** `docs/mockup/` (add after Claude Designer session)
**Progress log** (updated each session): `docs/progress-log.md`
**Constitution:** `.specify/memory/constitution.md`

## Spec-Driven Development (Spec Kit)

This project uses [Spec Kit](https://github.com/github/spec-kit) for spec-driven development.
The principles in this file are mirrored in `.specify/memory/constitution.md` — keep the two in
sync (amend both together). Per-feature artifacts live under `specs/NNN-*/` (`spec.md` → `plan.md`
→ `tasks.md`). Drive work with the `/speckit-*` skills: `/speckit-specify`, `/speckit-clarify`,
`/speckit-plan`, `/speckit-tasks`, `/speckit-analyze`, `/speckit-implement`.

**Branching:** This project follows Spec Kit's branch-per-feature model. Each feature/phase is
developed on its own `NNN-short-name` branch (e.g. `002-core-ui`), created by Spec Kit's
`create-new-feature.sh` alongside the matching `specs/NNN-short-name/` artifacts. Work stays on
that branch and is merged into `main` via a pull request once the feature's quality gates pass —
one feature = one branch = one PR. `docs/budget-planner.feature` remains the acceptance source of
truth and each feature's `specs/NNN-*/plan.md` + `tasks.md` hold its detailed engineering plan.

---

## Architecture

### Stack
- **Backend:** FastAPI (Python)
- **Frontend:** React + Vite
- **Database:** SQLite — file on USB SSD in production, local file in development
- **AI:** Anthropic API (`claude-sonnet-4-6`)
- **Hosting:** Raspberry Pi 5 (production), localhost (development)
- **Remote access:** Tailscale (infrastructure only, outside app scope)
- **Backup:** Nightly systemd timer (with catch-up) → private GitHub repo via SSH

### Project Structure
```
budget-planner/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── database.py          # SQLite connection and schema
│   ├── models.py            # SQLAlchemy models
│   ├── routers/
│   │   ├── months.py
│   │   ├── income.py
│   │   ├── bills.py
│   │   ├── accounts.py
│   │   ├── amendments.py
│   │   └── claude.py        # Claude API integration
│   └── schemas.py           # Pydantic schemas
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Income.tsx
│   │   │   ├── Bills.tsx
│   │   │   ├── Accounts.tsx
│   │   │   ├── Claude.tsx
│   │   │   ├── Amendments.tsx
│   │   │   └── MonthManagement.tsx
│   │   ├── api/             # API client functions
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
├── scripts/
│   └── backup.sh            # Nightly backup script (run by a systemd timer)
├── docs/
│   ├── budget-planner-spec.md
│   ├── budget-planner.feature
│   └── mockup/
├── .env.local               # Local dev config (gitignored)
├── .env.production          # Pi production config (gitignored)
└── CLAUDE.md
```

---

## Environment Configuration

All environment-specific values are set via `.env` files. Never hardcode these.

### `.env.local` (development)
```
DATABASE_URL=./data/budget-dev.db
ANTHROPIC_API_KEY=sk-...
APP_PIN=                     # Leave blank to disable PIN in dev
```

### `.env.production` (Pi)
```
DATABASE_URL=/mnt/usbssd/budget.db
ANTHROPIC_API_KEY=sk-...
APP_PIN=                     # Optional 4-digit PIN
```

There is deliberately **no API base URL setting**. The backend serves the built frontend
(`mount_frontend` in `backend/main.py`), so the app calls a relative `/api` on whatever
origin served it — one build works over the LAN and over Tailscale alike. Vite uses the
`VITE_` prefix for any frontend env var; the backend reads vars via pydantic-settings.

---

## Local Development

### Running locally

Two terminal processes:

**Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8001
```

**Frontend:**
```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173`. Vite proxies `/api` requests to `http://localhost:8001` — configured in `vite.config.ts`:

```ts
server: {
  proxy: {
    '/api': 'http://localhost:8001'
  }
}
```

This avoids CORS issues in development without any special backend config.

Port 8001, not 8000: the Pi is shared with the family dashboard, which owns 8000. Dev
matches production so both apps can run side by side — see "Shared Raspberry Pi" below.

### Local database
SQLite file lives at `./data/budget-dev.db` in development. This directory is gitignored. Do not commit the database file.

### Backup script
The nightly backup systemd timer is Pi-only. Do not run or test `scripts/backup.sh` in local development.

---

## Deployment (Raspberry Pi 5)

### Services
**One** systemd service, `budget-backend`, serving both the API and the built frontend on
port 8001. Process management is via systemd, not Docker. There is no separate frontend
service — the Pi is shared with the family dashboard and a second static-file process
would be one more port, one more unit and one more thing holding memory.

### Frontend build
```bash
cd frontend
NODE_OPTIONS="--max-old-space-size=1024" npm run build
```
`backend/main.py` mounts the resulting `dist/` via `StaticFiles` (see `mount_frontend`).
The mount is registered after every router, because a mount at `/` is greedy for any
unmatched path. If `dist/` does not exist — the normal case in development, where Vite
serves the frontend — nothing is mounted and the API serves alone.

### Database location
SQLite file on USB SSD mounted at `/mnt/usbssd/`. Never store the database on the Pi's SD card.

### Starting the service
```bash
sudo systemctl start budget-backend
```

---

## Database

### Schema principles
- All monetary values stored as `REAL` (float), displayed in GBP throughout
- All timestamps stored as UTC, displayed in local time in the UI
- The `amendments` table is append-only — never delete amendment records
- `source` field on amendments must always be either `"user"` or `"claude"`

### Budget calculation
These calculations must be consistent across backend and frontend:

```
total_income     = SUM(income_entries.amount) WHERE month_id = ?
total_bills      = SUM(bills.amount) WHERE month_id = ?
monthly_surplus  = total_income - total_bills
```

Never calculate these client-side from stale data. Always fetch fresh from the API after any write.

### Month carry-forward
When creating a new month, offer to carry forward items where `is_recurring = TRUE` from the most recent previous month. Amounts are copied as-is. The user may amend before confirming. Non-recurring items are never carried forward.

---

## Claude Integration

### Privacy boundary (ADR)
Claude is called only from the `/api/claude` endpoint. Each request sends the household's full
financial picture as structured JSON so Claude can analyse and forecast across months:
- Every month's income, bills, surplus, and amendments
- All account balances and their historical changes
- The user's message
- The conversation history for the current session

**Never send:** the raw database file, application secrets, `.env`, or the PIN — only the
structured financial data above. Writes are confined to the current month — the month whose
`YYYY-MM` matches the current calendar month (local time); previous and future-dated months are
read-only. (Amended 2026-07-26; mirrored in constitution Principle IV v1.2.0.)

### Write behaviour
Claude can write directly to the database via tool calls exposed by the backend. The confirm-then-act pattern is enforced in the system prompt — Claude must state its intended action and effect before executing.

Every Claude-initiated write must:
1. Be tagged `source: "claude"` in the amendments log
2. Include a human-readable `reason` field describing what changed and why
3. Recalculate and return updated budget figures in the same response

### Undo
The frontend tracks Claude writes within the current session. The "Undo last Claude change" button reverts the most recent `source: "claude"` amendment. This is session-scoped — it resets when the Claude screen is closed.

### System prompt
```
You are a helpful family budget assistant. You have access to the
household's full financial history below (all months, plus account
balances and their changes) and can read it for analysis and
forecasting. You can write directly to the current month using the
tools available to you.

Rules:
- Always state what you are about to do and its effect on
  surplus or account balances BEFORE executing any write
- Tag every write with a clear reason
- Never invent or approximate figures not present in the data
- If an instruction is ambiguous (e.g. multiple matching bills),
  ask for clarification before writing
- Previous months are read-only — never write to them
- Be concise — the user is on a phone

Financial data (all months and accounts):
{budget_json}
```

### Model
Always use `claude-sonnet-4-6` for the Claude integration. Do not use Opus for runtime API calls — Sonnet is appropriate for this use case and more cost-efficient.

---

## Linting

Run **both** linters before considering any code changes complete. Fix all errors and warnings — do not suppress without justification.

### Backend (ruff)
```bash
cd backend
ruff check .          # lint
ruff format --check . # format check (CI); use `ruff format .` to auto-fix
```

Config lives in `ruff.toml` at the repo root. Key rules enforced: E/W (pycodestyle), F (pyflakes), I (isort), UP (pyupgrade), B (bugbear).

### Frontend (ESLint + TypeScript)
```bash
cd frontend
npm run lint          # ESLint (configured by Vite scaffold)
npx tsc --noEmit      # type-check without emitting files
```

### When to lint
- After completing any code change, before running tests
- After fixing a failing test
- Before every commit

### Lint failures block commits
A commit with outstanding lint errors is not allowed. Fix the code, not the linter config, unless the rule is genuinely inapplicable — in which case add an inline `# noqa: <code>` / `// eslint-disable-next-line` with a comment explaining why.

---

## Testing

### Framework
pytest for backend unit and API tests. Vitest for frontend tests (Phase 2+).

### What to test
- Budget calculation logic (income / bills / monthly surplus)
- Carry-forward logic (recurring items only, correct amounts)
- Amendment logging (correct source, old/new values, reason)
- Claude undo logic (most recent Claude write only, session-scoped)
- API endpoints (happy path + key error cases)

### Running tests
```bash
cd backend
pytest

cd frontend
npm run test
```

### Feature files
The Gherkin scenarios in `docs/budget-planner.feature` are the source of truth for acceptance criteria. When implementing a feature, read the relevant scenarios first. Exhaustive negative/error scenarios not in the feature file should be added as implementation reveals edge cases.

---

## MUST follow — build order

1. MUST write Gherkin feature file first, before any code
2. MUST write failing tests before implementation
3. MUST write minimum code to pass tests — nothing more
4. MUST run mutation tests after implementation; MUST NOT leave surviving mutants without documented justification. **Never on the Pi** — see below
5. MUST run linters (`ruff check .` for backend, `npm run lint && npx tsc --noEmit` for frontend) and fix all errors before proceeding
6. MUST confirm all tests pass before committing
7. MUST update `MUTANTS.md` for any surviving mutants that will not be addressed — record the mutant ID, what was mutated, and why it is acceptable

### MUST NOT run mutation tests on the Raspberry Pi

Step 4 is a **development-machine** step. The Pi is a 4GB Pi 5 shared with the family
dashboard, running two backends and a Chromium kiosk. mutmut re-runs the whole suite per
mutant and Stryker spawns parallel Vitest workers; either will exhaust memory and take the
OOM killer to a live service.

If you are running on the Pi: do steps 1–3 and 5–7, commit, and run mutation tests later on
a laptop. Do not treat step 4 as blocking, and do not work around
`scripts/assert-not-pi.sh`, which guards `npm run test:mutation` and should prefix any
`mutmut run`.

---

## Clarifications & Assumptions

- MUST use the AskUserQuestion tool to clarify any ambiguity before writing code — do not guess at intent
- If proceeding with an assumption is unavoidable, output a clearly labelled **Assumptions Made** section at the end of every response listing each one
- Never silently assume — if something is unclear, ask

---

## Session Handoff

At the end of every session, before closing, MUST update `docs/progress-log.md`:
- Mark the phase status ✅ complete
- List specific files created/modified and key functions implemented
- Note any decisions that differ from or extend the spec documents
- Note anything that looks like a bug but is intentional — so future sessions don't "fix" it
- Write the exact first thing the next session should do
- Add any spec divergences to the Spec Divergences table in progress-log.md

This is not optional. A session without a progress log update is incomplete.

---

## Git

- Develop each feature/phase on its own `NNN-short-name` branch (Spec Kit model); merge to
  `main` via a pull request once the feature's quality gates pass — one feature, one branch, one PR
- MUST commit one logical change per commit with a clear message
- NEVER commit placeholder or TODO code without a corresponding GitHub Issue reference
- NEVER commit API keys, secrets, or local `.env` files

---

## What NOT to Do

- NEVER refactor working code unless explicitly asked
- NEVER add features outside the current phase scope without asking first
- NEVER install new npm packages without confirming with the user

---

## Python Packaging

Use `pyproject.toml` for all Python dependency and tool configuration. Runtime deps under `[project.dependencies]`, dev/test deps under `[project.optional-dependencies] dev`. Ruff, pytest, mutmut, and httpx all go in the `dev` optional group. Declare **floors** here, not exact pins.

Install for development:
```bash
pip install -e ".[dev]"
```

`backend/requirements.lock` holds the exact resolved **runtime** versions and is what the Pi installs from, so a deploy gets what was tested rather than whatever PyPI resolves that night. It is generated, never hand-edited — regenerate it whenever `pyproject.toml` dependencies change:

```bash
cd backend
uv pip compile pyproject.toml --universal --python-version 3.14 -o requirements.lock
```

This is not a `requirements.txt` in the sense the rule above forbids: `pyproject.toml` remains the source of truth for what this project depends on, and the lock is its compiled output. Same pattern as `family-dashboard/backend/requirements.lock`.

---

## Code Standards

- **TypeScript** throughout the frontend — no `any` types
- **Pydantic** schemas for all FastAPI request/response models
- **No raw SQL** — use SQLAlchemy ORM throughout
- **No inline styles** in React — use CSS modules or Tailwind utility classes
- **Mobile-first** CSS — design for portrait phone, enhance for larger screens
- All monetary figures formatted as `£X,XXX.XX` in the UI
- Negative figures shown in red with a minus sign, never parentheses

---

## Model Selection Guide

| Task | Model |
|---|---|
| Phase 0 (infrastructure setup) | Opus |
| Phase 1 (data layer, schema) | Opus |
| Phase 2 (core UI) | Sonnet |
| Phase 3 (Claude integration) | Sonnet |
| Phase 4 (backup automation) | Sonnet |
| Phase 5 (polish, hardening) | Sonnet |
| Runtime API calls (in-app Claude) | claude-sonnet-4-6 |

---

## Session Management

Use the `/end-session` slash command at the end of each Claude Code session. This should:
1. Summarise what was completed in the session
2. List any decisions made or assumptions taken
3. Note the next phase and suggested starting point
4. Flag any unresolved questions for the next session

---

## Phased Plan Summary

| Phase | Description | Model |
|---|---|---|
| 0 | Infrastructure — Pi setup, repo, FastAPI skeleton, Vite scaffold, backup repo | Opus |
| 1 | Data layer — schema, CRUD endpoints, carry-forward logic, budget calculations, tests | Opus |
| 2 | Core UI — all screens functional against real data, no Claude yet | Sonnet |
| 3 | Claude integration — chat UI, context injection, direct writes, undo | Sonnet |
| 4 | Backup automation — systemd timer, JSON export, Git push, recovery test | Sonnet |
| 5 | Polish & hardening — PIN, error states, README, end-to-end test | Sonnet |

---

## Known Constraints & Decisions

- **No user accounts in MVP** — single shared access, optional PIN only
- **No persistent Claude chat history** — conversation resets per session
- **Claude does not write to previous months** — enforced in system prompt and backend
- **SQLite only** — no migrations framework needed at this scale; schema changes handled manually with documented migration steps
- **Google Drive backup skipped in MVP** — nightly GitHub backup is the sole offsite copy; revisit post-MVP
- **Tailscale is an infrastructure prerequisite** — not configured or managed by the app

---

## Shared Raspberry Pi

This app shares a 4GB Pi 5 with the **family dashboard** (`ryan684/family-dashboard`),
which was deployed first. Full detail in that repo's `hardware.md`, "Sharing the Pi with
the budget planner", and in this repo's README under "Sharing the Pi". What matters here:

- **Port 8001 belongs to this app** (dev and production); the dashboard owns 8000. Both
  previously bound `0.0.0.0:8000` — the loser would have crash-looped. Never move back.
- **The backup timer is 03:30**; the dashboard's deploy is 02:00 and its build can run
  15–30 minutes. Don't move them closer.
- **Python 3.14 and Node 22 are shared installs** — one interpreter, one Node, a separate
  `backend/.venv` and `frontend/node_modules` per app. The two apps' dependency *sets*
  differ deliberately (this repo is on React 19 and ESLint 10, the dashboard on 18 and 9);
  don't try to align them. Only the binaries are shared.
- **Memory is the binding constraint.** Don't add long-running processes to the Pi. Build
  the frontend with `NODE_OPTIONS=--max-old-space-size=1024`.
- **Never run mutation tests on the Pi** — see the build order above.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/005-polish-hardening/plan.md`
<!-- SPECKIT END -->
