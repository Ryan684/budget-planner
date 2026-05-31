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

### III. Typed, Schema-Driven, ORM-Only
TypeScript throughout the frontend (no `any`). Pydantic schemas for all FastAPI
request/response models. SQLAlchemy ORM only — no raw SQL. No inline styles in React (CSS
modules or Tailwind). Mobile-first CSS. Money shown as `£X,XXX.XX`; negatives in red with a
minus sign, never parentheses.

### IV. Privacy & Minimal AI Context
Claude is called only from the `/api/claude` endpoint and receives only the minimum context
needed for the current question — current month's budget, accounts, amendments, the user's
message, and session history. Never the raw database or unrelated prior months (unless the
user explicitly asks, then append only that month). Every Claude write is tagged
`source: "claude"` with a human-readable `reason`, states its effect before executing, and
returns recalculated figures. Previous months are read-only.

### V. Data Durability & Integrity
All monetary values are stored as REAL/float, displayed in GBP. All timestamps stored UTC,
displayed local. The `amendments` table is append-only — amendment records are never deleted.
The `source` field is always `"user"` or `"claude"`. Budget figures are always recomputed
fresh from the API after any write — never from stale client data.

## Technical Constraints

- **Stack:** FastAPI (Python) backend; React + Vite (TypeScript) frontend; SQLite database;
  Anthropic API (`claude-sonnet-4-6`) for runtime AI calls.
- **Packaging:** Python deps and tool config in `pyproject.toml` (no `requirements.txt`);
  runtime deps in `[project.dependencies]`, dev/test (ruff, pytest, mutmut, httpx) in
  `[project.optional-dependencies] dev`. Install with `pip install -e ".[dev]"`.
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

**Version**: 1.0.0 | **Ratified**: 2026-05-30 | **Last Amended**: 2026-05-30
