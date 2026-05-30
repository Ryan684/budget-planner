# Implementation Plan: Phase 1 — Budget Data Layer

**Branch**: `001-phase-1-data-layer` | **Date**: 2026-05-30 | **Spec**: `./spec.md`
**Input**: Feature specification from `/specs/001-phase-1-data-layer/spec.md`

## Summary

Build a runnable, fully-tested FastAPI + SQLAlchemy backend that persists five tables, exposes
CRUD for every entity, computes budget totals, handles recurring-only month carry-forward, and
logs every write to an append-only amendments table. Tests-first, then mutation-tested. The
file-by-file responsibilities, model fields, and endpoint table are detailed in the sections below.

## Technical Context

**Language/Version**: Python 3.14
**Primary Dependencies**: FastAPI, SQLAlchemy 2.x, Pydantic v2, pydantic-settings, python-dotenv
**Storage**: SQLite (local dev file; USB SSD in production)
**Testing**: pytest + httpx (TestClient); mutmut for mutation testing; ruff for lint/format
**Target Platform**: Linux server (Raspberry Pi 5 in production; localhost in dev)
**Project Type**: web (backend slice only this phase)
**Performance Goals**: N/A (single-household scale; correctness over throughput)
**Constraints**: SQLite only (no migrations framework); REAL/float money; UTC timestamps
**Scale/Scope**: 2 users, single household, ~dozens of rows per month

## Constitution Check

*GATE: passes — no violations.*

| Principle | Compliance |
|---|---|
| I. Spec-first, test-first | Gherkin exists; failing tests precede each code slice ✅ |
| II. Quality gates | ruff + pytest + mutmut/`MUTANTS.md` required before done ✅ |
| III. Typed, schema-driven, ORM-only | Pydantic schemas; SQLAlchemy ORM, no raw SQL ✅ |
| IV. Privacy & minimal AI context | N/A this phase (no Claude); seam left in `crud.py` ✅ |
| V. Data durability & integrity | amendments append-only; REAL money; UTC; fresh recompute ✅ |

No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```
specs/001-phase-1-data-layer/
├── spec.md      # WHAT/WHY
├── plan.md      # this file
└── tasks.md     # dependency-ordered task list
```

### Source Code (repository root)

```
backend/
├── main.py            # FastAPI app, router registration, lifespan→init_db, /api/health
├── config.py          # pydantic-settings (DATABASE_URL, APP_PIN) via python-dotenv
├── database.py        # engine, SessionLocal, Base, get_db, init_db
├── models.py          # 5 SQLAlchemy models
├── schemas.py         # Pydantic Create/Update/Read + summary schemas
├── crud.py            # generic create/update/delete + amendment-logging helper (Phase 3 seam)
├── budget.py          # pure calc functions (mutation target)
├── carry_forward.py   # preview() + build_carried_items()
├── routers/{months,income,bills,accounts,amendments}.py
├── pyproject.toml
└── tests/{conftest.py, factories.py, test_*.py}
```
Repo root: `MUTANTS.md`. (`.gitignore` already created by Spec Kit init and covers data/, .env*,
*.db, caches, mutants/.)

## Key Design Decisions (ratified)

- Backend tests use **pytest** (the spec's "Vitest for Phase 1" is a documented error → recorded
  as a spec divergence). Vitest is frontend-only (Phase 2).
- `account_balances.account_type` (`current|savings`) added now to enable `total_savings`.
- **All** writes (create/edit/delete) logged; amendments never cascade-deleted; `entity_id` is a
  plain integer, not an enforced FK, so deleting an entity preserves the audit trail.
- Duplicate month → 409; amounts ≥ 0; `due_date` 1–31.
- Carry-forward = preview endpoint + a single create POST carrying per-item overrides (no
  server-side session state). "Most recent previous month" = greatest `month` text < target.
- Amendment logging centralized in one reusable `crud.py` helper; `source`/`reason` are
  parameters so Phase 3 (Claude) reuses the same path with `source="claude"`.

## Complexity Tracking

None — design stays within constitutional constraints.
