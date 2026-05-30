<!--
Spec Kit PILOT — this directory mirrors what `specify init` + the /speckit.* commands
would generate, scaffolded manually because outbound network is restricted in this
environment (the official `specify` CLI could not be installed). It is for evaluating
the Spec Kit flow against the existing CLAUDE.md / phase-1.md flow. Non-authoritative.
-->

# Family Budget Planner Constitution

## Core Principles

### I. Spec-First, Test-First (NON-NEGOTIABLE)
Every feature begins as a written spec, then Gherkin acceptance scenarios, then failing
tests, then the minimum code to pass. No production code is written before a failing test
exists for it. The Gherkin scenarios in `docs/budget-planner.feature` are the source of
truth for acceptance criteria.

### II. One Logical Change per Commit
Commits are small and self-describing. No placeholder/TODO code is committed without a
referenced tracking issue. Secrets and local `.env` files are never committed.

### III. Quality Gates Block Merge
A change is not "done" until: linters pass (`ruff check .` / `ruff format --check .` for
backend; `npm run lint && npx tsc --noEmit` for frontend), all tests pass, and mutation
testing leaves no undocumented surviving mutants (recorded in `MUTANTS.md`).

### IV. Mobile-First, Typed, Schema-Driven
TypeScript throughout the frontend (no `any`); Pydantic schemas for all FastAPI
request/response models; SQLAlchemy ORM only (no raw SQL); mobile-first CSS; money shown
as `£X,XXX.XX`, negatives in red with a minus sign.

### V. Privacy & Data Durability
Claude receives only the minimum context needed for the current question — never the raw
database or unrelated months. The `amendments` table is append-only. All monetary values
are REAL/float; all timestamps stored UTC.

## Technical Constraints

- Backend: FastAPI (Python). Frontend: React + Vite (TypeScript). DB: SQLite.
- Python deps/tooling via `pyproject.toml` (no `requirements.txt`); install `pip install -e ".[dev]"`.
- Runtime AI calls use `claude-sonnet-4-6`. SQLite only — no migrations framework.

## Development Workflow

Build order (MUST follow): Gherkin → failing tests → minimum code → mutation tests →
lint → confirm tests pass → update `MUTANTS.md` → update `docs/progress-log.md`.
Clarify ambiguity before coding; never silently assume.

## Governance

This constitution supersedes ad-hoc practice. The authoritative project instructions
remain in `CLAUDE.md`; this file is the Spec Kit-shaped projection of those rules for the
pilot. Amendments require updating both this file and `CLAUDE.md` together to avoid drift.

**Version:** 0.1.0 (pilot) | **Ratified:** 2026-05-30 | **Last amended:** 2026-05-30
