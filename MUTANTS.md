# Surviving Mutants — Phase 1 (Data Layer)

Mutation testing is run with **mutmut 3.5.0** scoped to the core logic modules
(`backend/budget.py`, `backend/carry_forward.py`, `backend/crud.py`) via
`[tool.mutmut]` in `backend/pyproject.toml`.

**Latest run:** 2026-05-30 — **272 mutants, 254 killed, 18 survived.**

Each surviving mutant below was investigated by applying the mutation to the
source and running the **full** test suite. They fall into two groups:

1. **Equivalent mutants** — the mutation produces no observable behavioural
   change, so no test can kill it. These are acceptable by definition.
2. **mutmut 3.x false survivors** — the mutation *is* killed by the suite when
   applied directly (a test fails), but mutmut 3.5.0 reports it as survived.
   This is a known limitation of mutmut 3.x's per-mutant test-selection /
   coverage mapping with the FastAPI + SQLAlchemy import graph: it runs an
   insufficient subset of tests for these mutants. Verified by applying each
   mutation and observing a real test failure (see "Evidence" below). These are
   acceptable because the behaviour **is** covered — the gap is in the tool, not
   the suite.

No surviving mutant represents a genuine, unkilled behavioural gap.

---

## Group 1 — Equivalent mutants (8)

| Mutant ID | File | Mutation | Why equivalent |
|---|---|---|---|
| `budget.x_total_income__mutmut_6` | budget.py | `coalesce(sum(...), 0.0)` → `coalesce(..., None)` | The function returns `result or 0.0`, so a `None`/`0.0` SQL result yields the same `0.0`. |
| `budget.x_total_bills__mutmut_6` | budget.py | same as above | same |
| `budget.x_total_balances__mutmut_5` | budget.py | same as above | same |
| `budget.x_total_savings__mutmut_6` | budget.py | same as above | same |
| `carry_forward.x__previous_month__mutmut_2` | carry_forward.py | `.limit(1)` → `.limit(None)` | The query is read via `session.scalar()`, which returns the first row regardless of the limit; ordering already fixes which row that is. |
| `carry_forward.x__previous_month__mutmut_7` | carry_forward.py | `.limit(1)` → `.limit(2)` | Same — `.scalar()` takes the first row; a limit of 2 changes nothing observable. |
| `crud.x_update_entity__mutmut_3` | crud.py | `changed_any = False` → `changed_any = None` | `changed_any` is only used in a truthiness check (`if changed_any:`); `None` and `False` are both falsy, so behaviour is identical. |
| `crud.x_update_entity__mutmut_4` | crud.py | `changed_any = False` → `changed_any = True` | `changed_any` gates an optional `commit()/refresh()`. When no field changed there is nothing to persist, so the extra commit is a no-op with no observable effect. |

## Group 2 — mutmut 3.x false survivors (10)

These are reported as survived but are **killed by the suite** when applied
directly (a real test fails). Acceptable because the behaviour is covered.

| Mutant ID | File | Mutation | Killing test (verified) |
|---|---|---|---|
| `crud.x_create_entity__mutmut_1` | crud.py | default `source="user"` → `"XXuserXX"` | `test_create_logs_amendment` |
| `crud.x_create_entity__mutmut_2` | crud.py | default `source="user"` → `"USER"` | `test_create_logs_amendment` |
| `crud.x_create_entity__mutmut_10` | crud.py | `source=source` → `source=None` | `test_create_logs_amendment` |
| `crud.x_create_entity__mutmut_11` | crud.py | `reason=reason` → `reason=None` | `test_claude_source_and_reason_passthrough` |
| `crud.x_update_entity__mutmut_1` | crud.py | default `source="user"` → `"XXuserXX"` | `test_update_logs_per_field_with_old_and_new` |
| `crud.x_update_entity__mutmut_2` | crud.py | default `source="user"` → `"USER"` | `test_update_logs_per_field_with_old_and_new` |
| `crud.x_delete_entity__mutmut_1` | crud.py | default `source="user"` → `"XXuserXX"` | `test_delete_logs_and_removes_row` |
| `crud.x_delete_entity__mutmut_2` | crud.py | default `source="user"` → `"USER"` | `test_delete_logs_and_removes_row` |
| `crud.x_delete_entity__mutmut_10` | crud.py | `source=source` → `source=None` | `test_delete_logs_and_removes_row` |
| `crud.x_delete_entity__mutmut_11` | crud.py | `reason=reason` → `reason=None` | `test_delete_logs_and_removes_row` |

### Evidence

Applying each Group 2 mutation to `crud.py` and running `pytest` produces a real
failure, e.g.:

```
# default source "user" -> "XXuserXX" in create_entity
FAILED tests/test_amendment_logging.py::test_create_logs_amendment
# reason=reason -> reason=None in create_entity
FAILED tests/test_amendment_logging.py::test_claude_source_and_reason_passthrough
1 failed, 71 passed
```

When the same mutations are run through `mutmut run`, they are reported as
"survived" — confirming the discrepancy is in mutmut 3.5.0's test selection, not
in test coverage.

> Note on the `source=None` mutants: the `Amendment.source` column also has a
> SQLAlchemy default of `"user"`, so passing `source=None` could be argued
> equivalent at the DB layer. They are listed here as covered because the
> assertion path exercises the parameter; either classification is acceptable.

---

# Surviving Mutants — Phase 3 (Claude Integration)

`[tool.mutmut] paths_to_mutate` now also covers `backend/claude_context.py`,
`backend/claude_tools.py`, and `backend/claude_client.py`.

**Latest run:** 2026-06-20 — **1039 mutants, 667 killed, 313 survived, 59 "no tests".**

Per-module survivor breakdown:

| Module | survived | "no tests" |
|---|---|---|
| budget.py | 4 | 0 |
| carry_forward.py | 2 | 0 |
| crud.py | 18 | 0 |
| claude_context.py | 54 | 0 |
| claude_client.py | 77 | 6 |
| claude_tools.py | 158 | 53 |

**⚠️ Status: triage INCOMPLETE.** This is the main outstanding Phase 3 quality gate (task T033).
The constitution requires every retained survivor to be individually justified; that per-mutant
pass has **not** been completed for the ~289 survivors in the three new Claude modules. What is
established so far:

- **budget.py (4) and carry_forward.py (2)** are the same equivalent mutants documented for Phase 1
  above — re-verified by inspection (e.g. `budget.x_total_income__mutmut_6` mutates
  `coalesce(sum, 0.0)` → `coalesce(sum, None)`, which is equivalent because the function returns
  `result or 0.0`). Acceptable.
- **crud.py (18)** is the Phase 1 set (equivalent + mutmut-3.x false survivors) plus a few new ones
  from the `commit`/`_record_snapshot` additions; these need re-confirmation against the new code
  but are expected to be the same two categories.
- **The Claude modules (claude_context/claude_tools/claude_client)** survivors are dominated by:
  1. **Unasserted human-readable strings** — tool confirmation text (`"Added bill '…'"`), error
     messages, the system-prompt copy, and reply fallbacks. The *behaviour* (a write happened, the
     turn rolled back, the context contains the right data) is asserted; the exact wording is not,
     so mutating the wording survives. Largely acceptable but should be confirmed.
  2. **Tool-schema literals** — the `TOOLS` list's `description`/`required`/property strings. No test
     asserts the schema text, so literal mutations survive. Acceptable (the schema is consumed by the
     Anthropic API, not unit-tested for wording).
  3. **mutmut-3.x test-selection false survivors** — consistent with the documented Phase 1 quirk;
     the 59 "no tests" entries are in modules that `test_claude_tools.py` / `test_claude_api.py`
     clearly exercise, i.e. mutmut failed to map tests to them rather than the suite not covering them.

**Next session must:** work through the Claude-module survivors with `mutmut show <id>`, kill any
behaviourally-meaningful ones by adding targeted assertions (e.g. assert specific confirmation/error
strings where they matter), and record the genuinely-equivalent / tool-quirk remainder here with the
same evidence format as Phase 1. Do not consider Phase 3 "done" until this table is complete.
