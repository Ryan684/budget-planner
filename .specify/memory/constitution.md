# Family Budget Planner Constitution

## Core Principles

### I. Spec-First, Test-First (NON-NEGOTIABLE)
Every feature begins as a written spec, then Gherkin acceptance scenarios, then failing
tests, then the minimum code to pass — nothing more. No production code is written before a
failing test exists for it. The Gherkin scenarios in `docs/budget-planner.feature` are the
authoritative source of truth for acceptance criteria; read the relevant scenarios before
implementing. Ambiguity MUST be resolved (ask) before coding — never silently assume.

### II. Quality Gates Block "Done"
A change is not complete until, in order: linters pass (`ruff check .` and
`ruff format --check .` for backend; `npm run lint && npx tsc --noEmit` for frontend), all
tests pass, and mutation testing leaves no undocumented surviving mutants. Surviving mutants
that will not be addressed MUST be recorded in `MUTANTS.md` (mutant ID, what was mutated, why
acceptable). Fix the code, not the linter config, unless a rule is genuinely inapplicable
(then justify inline).

Mutation testing is a **development-machine** gate and MUST NOT run on the Raspberry Pi: the
Pi is a 4GB Pi 5 shared with the family dashboard, and mutmut or Stryker will exhaust its
memory and take the OOM killer to a live service. On the Pi, satisfy the other gates, commit,
and run mutation testing later on a development machine — it remains blocking for merge to
`main`, not for a commit made on the Pi. `scripts/assert-not-pi.sh` enforces this.

### III. Typed, Schema-Driven, ORM-Only
TypeScript throughout the frontend (no `any`). Pydantic schemas for all FastAPI
request/response models. SQLAlchemy ORM only — no raw SQL. No inline styles in React (CSS
modules or Tailwind). Mobile-first CSS. Money shown as `£X,XXX.XX`; negatives in red with a
minus sign, never parentheses.

### IV. Privacy & AI Data Boundary
Claude is called only from the `/api/claude` endpoint. It may read the household's full
financial picture for analysis and forecasting — every month's budget (income, bills,
surplus), all account balances and their historical changes, and the amendments log —
supplied as structured JSON, never the raw database file, application secrets, `.env`, or the
PIN. Every Claude write is tagged `source: "claude"` with a human-readable `reason`, states
its effect before executing, and returns recalculated figures. Writes are confined to the
**current month** — defined as the month whose `YYYY-MM` matches the current calendar month in
local time — while previous and future-dated months are read-only. This single definition of
"current month" governs both user edits and Claude writes (income and bills; a month's notes and
the non-month-scoped account balances remain editable).

### V. Data Durability & Integrity
All monetary values are stored as REAL/float, displayed in GBP. All timestamps stored UTC,
displayed local. The `amendments` table is append-only — amendment records are never deleted.
The `source` field is always `"user"` or `"claude"`. Budget figures are always recomputed
fresh from the API after any write — never from stale client data.

## Technical Constraints

- **Stack:** FastAPI (Python) backend; React + Vite (TypeScript) frontend; SQLite database;
  Anthropic API (`claude-sonnet-4-6`) for runtime AI calls.
- **Packaging:** Python deps and tool config in `pyproject.toml`, which declares version
  **floors** and is the source of truth; runtime deps in `[project.dependencies]`, dev/test
  (ruff, pytest, mutmut, httpx) in `[project.optional-dependencies] dev`. Install with
  `pip install -e ".[dev]"`. `backend/requirements.lock` is the generated, committed
  resolution of the runtime deps and is what the Pi installs from, so a deploy gets the exact
  versions that were tested; regenerate it with uv whenever dependencies change, never by hand.
- **Shared hardware:** production is one 4GB Raspberry Pi 5 shared with the family dashboard.
  This app owns port 8001 and the 03:30 backup timer; the dashboard owns 8000 and the 02:00
  deploy timer. Python 3.14 and Node 22 are single shared installs with a per-app venv and
  `node_modules`. The backend serves its own built frontend — one process, one port.
- **Persistence:** SQLite only — no migrations framework; schema changes are manual and
  documented. DB never committed; secrets and `.env` files never committed.
- **Calculations:** `total_income`, `total_bills`, `monthly_surplus = income − bills`,
  `total_balances`, `total_savings` must be consistent across backend and frontend.

## Development Workflow

Build order (MUST follow): Gherkin feature → failing tests → minimum code → mutation tests →
linters → confirm all tests pass → update `MUTANTS.md` → update `docs/progress-log.md`.

**Branching (Spec Kit model):** Each feature/phase is developed on its own branch named
`NNN-short-name` (e.g. `002-core-ui`), created by Spec Kit's `create-new-feature.sh` when the
spec is initialised. The matching artifacts live under `specs/NNN-short-name/`. Work for that
feature stays on its branch; when the feature's quality gates pass, it is merged into `main`
via a pull request (one feature = one branch = one PR). Commit one logical change per commit
with a clear message; never commit placeholder/TODO code without a referenced issue.

Carry-forward: when creating a new month, offer recurring items only from the most recent
previous month (amounts copied, amendable before confirm); non-recurring items and account
balances are never carried forward.

## Governance

This constitution and `CLAUDE.md` are kept in sync and together govern the project; where they
overlap, they must agree — amend both together to prevent drift. The constitution supersedes
ad-hoc practice. Pull requests must verify compliance with these principles and the quality
gates before merge to `main`. The phased plan (0: infra, 1: data layer, 2: UI, 3: Claude,
4: backup, 5: hardening) and per-phase model selection are recorded in `CLAUDE.md`. Spec Kit
artifacts live under `specs/NNN-*/`; `docs/progress-log.md` is the authoritative session-handoff
record.

**Version**: 1.3.0 | **Ratified**: 2026-05-30 | **Last Amended**: 2026-08-17

> **1.3.0 (2026-08-17)** — Principle II: mutation testing is scoped to development machines and
> MUST NOT run on the Raspberry Pi; it stays blocking for merge to `main` but no longer blocks a
> commit made on the Pi. Technical Constraints: added a committed `requirements.lock` as the
> deploy-time resolution of the runtime dependencies (`pyproject.toml` keeps floors and remains
> the source of truth), and recorded the shared-Pi allocation — this app on port 8001 with the
> 03:30 backup timer, the family dashboard on 8000 with the 02:00 deploy timer, one shared
> Python 3.14 and Node 22, and the backend serving its own built frontend. Rationale: the two
> apps now share one 4GB Pi 5, which made the previous port collision fatal and memory the
> binding constraint. Mirrored in `CLAUDE.md`. No change to Principles I or III–V.

> **1.2.0 (2026-07-26)** — Principle IV: the "current month" that bounds writes is now explicitly
> the current **calendar** month (local `YYYY-MM`), superseding the prior de-facto "latest month"
> interpretation in the shipped Phase 2/3 code. A single definition governs user edits, Claude
> writes, and the dashboard's editable month; previous **and future-dated** months are read-only
> for income and bills (a month's notes and account balances remain editable). Rationale: editing
> should track the real calendar month, not whichever month was created most recently. Mirrored in
> `CLAUDE.md`. See `specs/005-polish-hardening/`.

> **1.1.0 (2026-06-18)** — Principle IV renamed *Privacy & Minimal AI Context* → *Privacy & AI
> Data Boundary*. Claude's read scope widened from "current month + one explicitly requested
> prior month" to the household's full multi-month financial picture (all months, account
> balances and their history). The boundary now excludes only the raw database file, secrets,
> `.env`, and the PIN. Write scope is unchanged — current month only; previous months remain
> read-only. Rationale: the household self-hosts and consents to analysis of its own finances,
> and cross-month context is what makes forecasting and trend analysis useful.
