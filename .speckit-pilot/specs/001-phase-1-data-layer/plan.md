# Implementation Plan: Phase 1 — Budget Data Layer

**Branch:** `speckit-pilot-phase-1` | **Spec:** `./spec.md`
**Source of detail:** the full engineering plan already exists at `/phase-1.md` — this file is
the Spec Kit-shaped wrapper around it (technical context + constitution check + structure).

## Summary
Build a runnable, fully-tested FastAPI + SQLAlchemy backend persisting five tables, exposing
CRUD for every entity, computing budget totals, handling recurring carry-forward, and logging
every write to an append-only amendments table. Tests-first, then mutation-tested.

## Technical Context
- **Language/Runtime:** Python 3.11+, FastAPI, SQLAlchemy 2.x, Pydantic v2.
- **Storage:** SQLite (local dev file; USB SSD in prod).
- **Testing:** pytest + httpx (TestClient); mutmut for mutation testing.
- **Packaging/Tooling:** `pyproject.toml` (`pip install -e ".[dev]"`); ruff for lint/format.
- **Scope:** backend only — no frontend, Claude, infra, or backup.

## Constitution Check
| Principle | Compliance |
|---|---|
| Spec-first, test-first | Gherkin exists; failing tests precede each code slice ✅ |
| Quality gates | ruff + pytest + mutmut/MUTANTS.md required before done ✅ |
| Typed, schema-driven | Pydantic schemas; SQLAlchemy ORM, no raw SQL ✅ |
| Privacy & durability | amendments append-only; REAL money; UTC timestamps ✅ |
| One change per commit | enforced at commit time ✅ |

No violations — no Complexity Tracking entries required.

## Project Structure (delta)
```
backend/
├── main.py, config.py, database.py, models.py, schemas.py, crud.py, budget.py, carry_forward.py
├── routers/{months,income,bills,accounts,amendments}.py
├── pyproject.toml
└── tests/{conftest.py, factories.py, test_*.py}
```
Repo root: `MUTANTS.md`, `.gitignore`. Full file-by-file detail, model fields, endpoint table,
and design decisions: see `/phase-1.md`.

## Key Design Decisions (ratified)
- Backend tests use **pytest** (the spec's "Vitest for Phase 1" is a documented error).
- `account_balances.account_type` (`current|savings`) added now to enable `total_savings`.
- **All** writes (create/edit/delete) logged; amendments never cascade-deleted; `entity_id`
  is a plain integer, not an enforced FK.
- Duplicate month → 409; amounts ≥ 0; `due_date` 1–31.
- Carry-forward = preview endpoint + single create POST with per-item overrides.

## Complexity Tracking
None — design stays within constitutional constraints.
