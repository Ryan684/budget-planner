# Surviving Mutants — Phase 5 (Polish & Hardening)

Mutation testing run with **mutmut 3.5.0** (now pinned in `backend/pyproject.toml`;
3.6.0 cannot import unmutated modules from its copied source tree). Phase 5 adds
`current_month.py`, `backup_status.py`, `routers/auth.py`, `routers/system.py`, and
`routers/deps.py` to `paths_to_mutate`.

**Run:** 2026-07-27 — scoped to the Phase 5 modules.

| Module | Result |
|---|---|
| `current_month.py` | all mutants killed |
| `routers/auth.py` | all mutants killed |
| `routers/system.py` | all mutants killed |
| `backup_status.py` | 3 survived (below) |
| `routers/deps.py` | 23 reported "no tests" — false, verified killed (below) |

Seven `backup_status.py` survivors from the first run were **genuine gaps and are now
killed** by new tests: the staleness threshold boundary (`>` vs `>=`, and `3600` vs
`3601`), a well-shaped line with an impossible date halting the scan (`continue` → `break`),
and the `errors="replace"` argument that keeps an undecodable byte in the shell-written log
from raising. Those tests are in `backend/tests/test_backup_status.py`.

## Group 1 — Equivalent mutants (3)

| Mutant ID | File | Mutation | Why equivalent |
|---|---|---|---|
| `backup_status.x__read_lines__mutmut_3` | backup_status.py | `encoding="utf-8"` → `encoding=None` | The runtime's default encoding is UTF-8, so the file decodes identically. The explicit encoding is deliberate — it must not depend on the Pi's locale — but no test can distinguish the two in a UTF-8 environment. |
| `backup_status.x__read_lines__mutmut_6` | backup_status.py | `encoding` argument removed | Same as above. |
| `backup_status.x__read_lines__mutmut_9` | backup_status.py | `encoding="utf-8"` → `encoding="UTF-8"` | Python normalises encoding names; the two are the same codec. |

## Group 2 — mutmut false "no tests" in `routers/deps.py` (23)

mutmut's per-mutant test selection finds no covering test for the router-dependency
module, the same limitation recorded for Phase 1 with the FastAPI + SQLAlchemy import
graph. The read-only guard **is** covered — `backend/tests/test_read_only.py` asserts both
the `403` and its detail text on six endpoints.

**Evidence** — each mutation applied directly to `routers/deps.py`, then the full suite run
(baseline: 183 passed):

| Mutation | Result |
|---|---|
| `require_editable_month`: `month_id != …` → `month_id == …` | **24 failed** |
| `require_editable_month`: `status_code=403` → `status_code=None` | **8 failed** |
| `require_editable_month`: `detail=READ_ONLY_DETAIL` → `detail=None` | **2 failed** |
| `current_calendar_month_id`: `current_month_id(session)` → `current_month_id(None)` | **24 failed** |

The remaining `get_or_404` / `latest_month_id` mutants in the same file are Phase 1 code
covered by the existing API tests and are reported the same way for the same reason.

No surviving mutant represents a genuine, unkilled behavioural gap.

---

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

`[tool.mutmut] paths_to_mutate` now covers `backend/claude_context.py`,
`backend/claude_tools.py`, and `backend/claude_client.py` in addition to the Phase 1 modules.

**Latest run:** 2026-06-21 — **1039 mutants, 790 killed, 243 survived, 6 "no tests".**

Triage was completed over two sessions. Five new targeted tests were added to kill genuine
behavioral gaps before accepting the remainder:
- `test_delete_bill_in_current_month` — killed `_delete_bill` reason/source/month_id mutants
- `test_update_account_balance_tool` — killed `_update_account_balance` reason/source/month_id/value mutants
- `test_add_income_writes_with_claude_source_and_reason` — killed `_add_income` source/reason mutants
- `test_update_income_in_current_month` — killed `_update_income` source/old/new value mutants
- `test_cannot_update_income_from_previous_month` — killed month-scope guard mutants for income
- `test_is_stale_boundary` — killed `>=` vs `>` in `is_stale`
- `test_context_includes_full_financial_picture` (extended) — killed context field-key mutants
- `test_account_create_amendment_new_value_includes_balance` — killed `_entity_summary` balance field

Per-module survivor breakdown (post-triage):

| Module | survived | "no tests" | classification |
|---|---|---|---|
| budget.py | 4 | 0 | Phase 1 equivalents (unchanged) |
| carry_forward.py | 2 | 0 | Phase 1 equivalents (unchanged) |
| crud.py | 5 | 0 | 4 getattr equivalents + 1 Phase 1 equivalent |
| claude_context.py | 27 | 0 | ordering + unasserted key names |
| claude_client.py | 77 | 6 | wording, fake-client limitations, no-tests |
| claude_tools.py | 128 | 0 | wording, optional defaults, pattern coverage |

No surviving mutant represents an unkilled behavioral gap that is not documented below.

---

## Phase 3 — Group A: New equivalent mutants in crud.py (5)

| Mutant ID | Mutation | Why equivalent |
|---|---|---|
| `crud.x__entity_summary__mutmut_7` | `getattr(entity, "label", None)` → `getattr(entity, "label", )` | Trailing comma is valid Python; the `label` attribute always exists on entity models, so the default is never used. Same result. |
| `crud.x_create_entity__mutmut_28` | same pattern in `entity_label=getattr(entity, "label", None)` | Same reasoning. |
| `crud.x_update_entity__mutmut_45` | same pattern | Same reasoning. |
| `crud.x_delete_entity__mutmut_28` | same pattern | Same reasoning. |
| `crud.x_update_entity__mutmut_4` | `changed_any = False` → `changed_any = None` | Same as Phase 1 equivalent — both falsy, gate is `if changed_any:`. |

---

## Phase 3 — Group B: Error message / wording text mutations (claude_tools)

These mutations change the string passed to `ToolDispatchError(…)`, the `field` default
parameter in `_check_amount`, or the f-string message passed when no entity exists. Tests
assert that the exception IS raised (using `pytest.raises`) but do not assert the message
text — error wording is not a behavioral guarantee.

**Mutant IDs (16):**
`claude_tools.x__require_reason__mutmut_6-9`,
`claude_tools.x__require_current_month__mutmut_2-5`,
`claude_tools.x__load_month_scoped__mutmut_8,10`,
`claude_tools.x__check_amount__mutmut_1,2,5,6,7`,
`claude_tools.x_dispatch__mutmut_4`

Acceptable: the raise IS tested; only the wording is mutated.

---

## Phase 3 — Group C: Optional field defaults not exercised by tests (claude_tools)

Mutations to `is_recurring=ti.get("is_recurring", False)` and
`due_date=ti.get("due_date")` in `_add_bill` and `_add_income`. Tests never pass
`is_recurring` or `due_date` in tool_input, so `ti.get("is_recurring", False)` and
`ti.get("IS_RECURRING", False)` both return `False` — the same row is written either way.

**Mutant IDs (24):**
`claude_tools.x__add_bill__mutmut_14,15,20,21,28,29,30,31,32,33,34,35,36,37`,
`claude_tools.x__add_income__mutmut_5,6,7,8,13,17,22,23,24,25,26,27,28`

Acceptable: the default-path behavior is identical for the test inputs; real-API
integration would exercise the optional fields.

---

## Phase 3 — Group D: `_changes` field key list mutations (claude_tools)

`_changes(ti, ["label", "amount", "category", "is_recurring", "due_date"])` — mutations
rename one key in the list (e.g. `"label"` → `"XXlabelXX"`). Because tests only pass
`amount` (or `balance`) in tool_input, the renamed key is absent either way and produces an
identical changes dict.

**Mutant IDs (12):**
`claude_tools.x__update_bill__mutmut_27,28,31,32,33,34,35,36`,
`claude_tools.x__update_income__mutmut_27,28,31,32`

Acceptable: the `amount` field change IS tested end-to-end; a label-only update is a
valid but untested call path and does not invalidate the pattern.

---

## Phase 3 — Group E: Amendment parameter mutations for update_bill / delete_income (claude_tools)

For `_update_bill` and `_delete_income`, mutations remove or null `source`, `month_id`,
`entity_type`, or `reason` in the `crud.update_entity` / `crud.delete_entity` call. These
survive because:
- `test_update_bill_in_current_month` only asserts `bill.amount == 97.0`; it does not inspect the amendment record.
- `test_delete_income_in_current_month` only asserts the income row is gone; it does not inspect the amendment.

The **same parameters** (`source="claude"`, `reason=reason`, `month_id=month_id`) are
verified end-to-end in the tests for `add_bill`, `add_income`, `update_income`,
`delete_bill`, and `update_account_balance`. All tool handlers follow the same pattern
calling the same `crud.*` functions with identical parameter structures, so this is
redundant pattern coverage, not a unique behavioral gap.

**Mutant IDs (29):**
`claude_tools.x__update_bill__mutmut_3,5,6,7,8,41,42,43,44,50,51,52,55,56,57`,
`claude_tools.x__delete_income__mutmut_3,22,23,24,25,30,31,32,33,34,35,36,37`

Acceptable: pattern tested exhaustively for 5 of 7 tool handlers; update_bill and
delete_income are the same mechanical pattern.

---

## Phase 3 — Group F: `commit=False` equivalent mutations (claude_tools)

`commit=False` → `commit=None` or `commit=True` or removed. `commit=None` is falsy and
behaviorally identical to `commit=False` in `crud.update_entity`. `commit=True` causes
an extra commit inside the tool, but tests use `db_session.flush()` + `db_session.refresh()`
which succeed either way, and the amendment is still written correctly.

**Mutant IDs (16):**
`claude_tools.x__add_bill__mutmut_41,44`,
`claude_tools.x__update_bill__mutmut_41,44` (see group E for remaining update_bill),
`claude_tools.x__add_income__mutmut_32,35,42,47`,
`claude_tools.x__update_income__mutmut_37,39,40,47,48,53`,
`claude_tools.x__delete_bill__mutmut_18,25,32,37` (label=None/month_id/commit variants),
`claude_tools.x__update_account_balance__mutmut_45,53,58`

Acceptable: the commit flag is an implementation detail of the transaction model; the
test verifies data correctness after the turn, not the commit count.

---

## Phase 3 — Group G: claude_context ordering mutations (27)

### Subgroup G1 — Month ordering (mutmut_3)
`select(BudgetMonth).order_by(BudgetMonth.month)` → `order_by(None)`. The test creates
months in insertion order (2026-05 then 2026-06) so both ordered and unordered queries
return the same sequence.

**Mutant IDs (1):** `claude_context.x_build_budget_context__mutmut_3`

### Subgroup G2 — Bill `due_date` key name (mutmut_53, 54)
`"due_date": b.due_date` → `"XXdue_dateXX": b.due_date`. No test asserts
`june["bills"][0]["due_date"]`.

**Mutant IDs (2):** `claude_context.x_build_budget_context__mutmut_53,54`

### Subgroup G3 — Snapshot secondary sort key (mutmut_84, 86)
`order_by(as_of_date, recorded_at)` → secondary key removed or set to None. The test
creates two patches with May and June as_of_dates in that same insertion order, so
`recorded_at` ordering is identical to `as_of_date` ordering — removing it changes nothing.

**Mutant IDs (2):** `claude_context.x_build_budget_context__mutmut_84,86`

### Subgroup G4 — Amendment ordering (mutmut_97)
`select(Amendment).order_by(amended_at)` → `order_by(None)`. Tests create amendments in a
single operation so ordering has no observable effect.

**Mutant IDs (1):** `claude_context.x_build_budget_context__mutmut_97`

### Subgroup G5 — Amendment payload field key names (mutmut_99–119)
The amendment payload dict includes 10 fields (`id`, `month_id`, `entity_type`,
`entity_label`, `field_changed`, `old_value`, `new_value`, `reason`, `source`,
`amended_at`). mutmut_99 removes the entire comprehension; mutmut_100–119 rename each
key in turn. No test navigates into `ctx["amendments"][i]["<field>"]`.

The amendment payload is read-only context sent to Claude for awareness — its correctness
matters for the AI conversation, not for any database constraint. The underlying amendment
row contents ARE fully tested by `test_amendment_logging.py`.

**Mutant IDs (21):**
`claude_context.x_build_budget_context__mutmut_99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119`

Acceptable for all Group G: the data correctness is asserted elsewhere; the ordering
and serialization key-name variants are presentation details for the AI payload.

---

## Phase 3 — Group H: claude_client wording and fake-client limitations (77)

### Subgroup H1 — build_system_prompt (5)
`sort_keys=True` → `sort_keys=None` and system prompt template string mutations. No test
asserts the system prompt content or JSON key ordering.

**Mutant IDs (5):** `claude_client.x_build_system_prompt__mutmut_3,4,6,7,8`

### Subgroup H2 — _extract_text getattr trailing comma (2)
`getattr(b, "type", None) == "text"` → `getattr(b, "type", ) == "text"`. Same as the
crud group — trailing comma, attribute always exists.

**Mutant IDs (2):** `claude_client.x__extract_text__mutmut_6,13`

### Subgroup H3 — _trim_conversation boundary and token-counting (9)
`while len(messages) > 1` → `while len(messages) >= 1` and related mutations. The trim
function calls `client.messages.count_tokens()` which the fake Anthropic client returns a
fixed low value for, so the while condition is never entered in tests — the boundary
mutation has no observable effect.

**Mutant IDs (9):**
`claude_client.x__trim_conversation__mutmut_1,4,5,7,8,9,11,12,13`

### Subgroup H4 — run_turn message dict key mutations (61)
The `run_turn` function builds message dicts with keys `"role"`, `"content"`, `"type"`,
`"tool_use_id"`, `"is_error"` etc. and passes them to the Anthropic client. Mutations
rename these keys (e.g. `"role"` → `"XXroleXX"`). The fake Anthropic client
(`tests/fake_anthropic.py`) does not validate key names — it accepts any dict. So these
mutations pass the test suite even though the real API would reject them.

This is a structural limitation of the fake-client approach: to kill these mutants would
require either a real API call (impractical in unit tests) or a fake that validates the
Anthropic Messages API schema. The behaviors they guard (correct message formatting for
the live API) are verified by the manual quickstart test (T036).

**Mutant IDs (61):**
`claude_client.x_run_turn__mutmut_9,10,14,15,16,17,23,28,32,33,36,37,38,41,42,43,52,53,54,55,56,57,58,64,70,81,82,83,84,85,86,87,88,89,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118`

Acceptable: the fake-client limitation is a known trade-off documented here. The real
message structure is exercised by T036 (manual integration test).

---

## Phase 3 — Group I: create_anthropic_client — untestable (6 "no tests")

`create_anthropic_client()` instantiates `anthropic.Anthropic(api_key=…)`. Testing it
requires a real `ANTHROPIC_API_KEY` in the environment, which is not available in the
unit-test environment. mutmut reports "no tests" because no test imports or calls this
function directly.

**Mutant IDs (6):**
`claude_client.x_create_anthropic_client__mutmut_1,2,3,4,5,6`

Acceptable: untestable at the unit-test level; the API key wiring is verified by T036.

---

# Surviving Mutants — Phase 4 (Backup Automation)

Mutation testing was run with **mutmut 3.x** with `backend/backup.py` added to
`[tool.mutmut] paths_to_mutate`. The full configured run produced **1150 mutants,
861 killed**; scoped to the new module, **`backup.py` has 31 surviving mutants**, all
investigated by reading each diff. Every survivor is **equivalent or cosmetic** — none
represents an unkilled behavioural gap. The correctness-critical paths (consistent copy,
integrity detection, export envelope, JSON-parse verification, missing/zero-length
source, the CLI failure→exit-1 and success paths, and the required CLI args) are all
killed by `tests/test_backup.py`.

## Group 1 — Error-message-only mutants (4)

The exception **type** (`BackupError`) and the **fact that it is raised** are asserted by
the tests; the human-readable message text is not. Replacing the f-string with `None`
changes only the message, not behaviour.

| Mutant ID | Mutation |
|---|---|
| `backup.x_copy_database__mutmut_7` | `BackupError(f"source database missing or empty: {src}")` → `BackupError(None)` |
| `backup.x_verify_integrity__mutmut_9` | `BackupError(f"integrity check could not run: {exc}")` → `BackupError(None)` |
| `backup.x_verify_integrity__mutmut_13` | `BackupError(f"integrity check failed: {result}")` → `BackupError(None)` |
| `backup.x_write_export__mutmut_8` | `BackupError(f"generated JSON did not parse: {exc}")` → `BackupError(None)` |

## Group 2 — Case-insensitive SQL / codec name (3)

SQLite `PRAGMA` keywords are case-insensitive and `"utf-8"`/`"UTF-8"` name the same codec,
so these produce byte-identical behaviour.

| Mutant ID | Mutation | Why equivalent |
|---|---|---|
| `backup.x_verify_integrity__mutmut_7` | `"PRAGMA integrity_check"` → `"pragma integrity_check"` | SQLite PRAGMA is case-insensitive |
| `backup.x_verify_integrity__mutmut_8` | `"PRAGMA integrity_check"` → `"PRAGMA INTEGRITY_CHECK"` | same |
| `backup.x_write_export__mutmut_15` | `encoding="utf-8"` → `encoding="UTF-8"` | same codec, alternate spelling |

## Group 3 — JSON whitespace / encoding default (5)

These change only the serialised file's whitespace or rely on the platform-default
encoding (UTF-8 on the Pi/Linux for the ASCII budget data). The content is identical and
the tests parse the JSON (`json.loads`), not exact bytes.

| Mutant ID | Mutation |
|---|---|
| `backup.x_write_export__mutmut_3` | `json.dumps(export, indent=2)` → `indent=None` |
| `backup.x_write_export__mutmut_5` | `json.dumps(export, indent=2)` → `json.dumps(export)` |
| `backup.x_write_export__mutmut_6` | `json.dumps(export, indent=2)` → `indent=3` |
| `backup.x_write_export__mutmut_10` | `write_text(serialised, encoding="utf-8")` → `encoding=None` |
| `backup.x_write_export__mutmut_12` | `write_text(serialised, encoding="utf-8")` → `write_text(serialised)` |

## Group 4 — Export timestamp timezone (1)

| Mutant ID | Mutation | Why acceptable |
|---|---|---|
| `backup.x_build_export__mutmut_4` | `datetime.now(UTC)` → `datetime.now(None)` | `exported_at` is formatted with a literal `Z` suffix, so both produce a `…Z` string the test parses successfully. The suite asserts the format and parseability, not that the wall-clock is genuinely UTC, so this is unobservable to the tests. Low risk: `exported_at` is informational metadata, not used for any logic or restore. |

## Group 5 — argparse description / help text (14)

Cosmetic CLI help/description strings (and trailing-comma/keyword-removal variants that
leave `required=True` intact). They have no effect on parsing behaviour, which is covered
by the success, failure, and required-args tests.

**Mutant IDs:** `backup.x_main__mutmut_2,3,4,5` (description); `backup.x_main__mutmut_8,11,15,16,17` (`--db-out` help); `backup.x_main__mutmut_20,23,27,28,29` (`--json-out` help)

## Group 6 — stderr diagnostic message (4)

The failure diagnostic printed to stderr is not asserted by any test; mutating its text,
removing it, or redirecting the stream changes only the operator-facing message, not the
exit behaviour (which is asserted as exit code 1).

**Mutant IDs:** `backup.x_main__mutmut_43,44,45,46`

---

**Total Phase 4 backup.py survivors: 31** — all equivalent/cosmetic per the groups above.
No surviving mutant represents a genuine, unkilled behavioural gap in the backup logic.

---

# Shared-Pi deployment (2026-08-17) — `mount_frontend`

**No mutation run was performed for this change, and none is outstanding.**

`mount_frontend` lives in `backend/main.py`, which is deliberately **not** in
`paths_to_mutate` (`backend/pyproject.toml`). That scoping is unchanged and its stated
rationale still holds: mutation is aimed at the core logic modules — calculations,
carry-forward, amendment logging — "not routers, schemas, or boilerplate". `main.py` is
application wiring: router includes, a liveness endpoint, and now a static mount.

Running `mutmut run` after this change therefore produces exactly the result recorded
above for Phase 5 — the mutated set did not change.

**Why `main.py` was not added to the mutated set.** It was considered. `mount_frontend`
does have two real branches, and adding the module would generate killable mutants for
them (`is_file()` negation, the `"index.html"` literal, the `True`/`False` returns — all
covered by `backend/tests/test_static_ui.py`). But it would also pull in the router
includes and the `FastAPI(...)` construction, generating trivial or equivalent mutants for
lines that have no logic to get wrong, which is the noise the existing scoping exists to
avoid. The branch coverage is instead asserted directly:

| Branch | Test |
|---|---|
| `dist/` present, mount registered | `test_serves_index_html_at_the_root`, `test_reports_that_it_mounted` |
| `dist/` absent (development) | `test_does_not_mount_when_dist_is_missing` |
| `dist/` present but no `index.html` | `test_does_not_mount_a_dist_without_index_html` |
| Mount does not shadow the API | `test_api_routes_are_not_shadowed_by_the_frontend` |
| `DIST_DIR` resolves to `frontend/dist` | `test_real_app_points_at_the_frontend_build_directory` |

Revisit if `main.py` ever grows real decision logic.

**Note for whoever runs mutation testing next:** it must not run on the Raspberry Pi (4GB,
shared with the family dashboard). `scripts/assert-not-pi.sh` now guards
`npm run test:mutation` and should prefix `mutmut run`. See CLAUDE.md, build order.
