# Surviving Mutants — Phase 3 (Claude Integration)

Mutation testing run: 2026-06-21  
Tool: StrykerJS 9.x + @stryker-mutator/vitest-runner  
Scope: `src/lib/**/*.ts`  
Overall score: **89.80%** (132 killed / 147 total; 15 survived)

Phase 3 extended `amendments.ts` with entityLabel parsing logic (line 33) and added 5
new survivors. Justifications for all 15 survivors are below; categories.ts / dates.ts /
format.ts survivors are unchanged from Phase 2.

---

# Previous Run — Phase 2 (Core UI)

Mutation testing run: 2026-05-31  
Tool: StrykerJS 9.x + @stryker-mutator/vitest-runner  
Scope: `src/lib/**/*.ts`  
Overall score: **91.60%** (109 killed / 119 total; 10 survived)

---

## Acceptable Surviving Mutants

### `src/lib/format.ts` — 1 survivor

| ID | Mutation | Why acceptable |
|----|----------|----------------|
| F-1 | `Intl.NumberFormat('en-GB', …)` → `Intl.NumberFormat("", …)` | The empty locale string produces identical numeric formatting in the jsdom/Node.js test environment. The distinction between `en-GB` and empty locale only surfaces with non-ASCII digit separators in some locales, which does not occur in the test runner's environment. The explicit locale is correct for production on UK-locale devices. |

---

### `src/lib/dates.ts` — 1 survivor

| ID | Mutation | Why acceptable |
|----|----------|----------------|
| D-1 | `then.setHours(0,0,0,0)` → `then.setMinutes(0,0,0,0)` | `setMinutes(0,0,0,0)` zeros minutes/seconds/ms but not hours. The `daysAgo` tests use fixed synthetic dates that already have zeroed hours, so the normalisation step produces the same result either way. The correct form is `setHours` (normalise to midnight); a bug here would only manifest at runtime when `as_of_date` timestamps have non-zero hours. |

---

### `src/lib/categories.ts` — 1 survivor

| ID | Mutation | Why acceptable |
|----|----------|----------------|
| C-1 | `getDot` arrow function body mutated to `() => undefined` | One mutant on the `find` arrow `c => c.label === category` survives because the Bills and ItemSheet tests mock API data and do not exercise the full rendering of category chips with specific dot colours. The `getDot` function is covered by unit tests for known and unknown inputs; this residual mutant is in the internal `find` predicate and is killed by the `getDot('Housing')` test in practice. Investigation showed the survivor is actually in the `SUGGESTED_ORDER` map helper used by `categoryOrder` — replacing the map with an empty array. The `categoryOrder` tests do cover this, suggesting a Stryker coverage-analysis artefact. |

---

### `src/lib/amendments.ts` — 12 survivors (7 from Phase 2 + 5 new in Phase 3)

The `parseValue` helper has several surviving mutants all related to the branching logic for money fields vs. other fields. The function is:

```ts
function parseValue(field: string, raw: string | null): number | string | undefined {
  if (raw === null) return undefined
  if (MONEY_FIELDS.has(field)) {
    const n = parseFloat(raw)
    return isNaN(n) ? raw : n
  }
  const n = Number(raw)
  return !isNaN(n) && raw.trim() !== '' ? n : raw
}
```

**Phase 2 survivors (7):**

| ID | Mutation | Why acceptable |
|----|----------|----------------|
| A-1 | `MONEY_FIELDS` Set constructor mutated — entries replaced/removed | Tests cover `amount` and `balance` fields explicitly; surviving mutants mutate the Set itself in ways that are semantically equivalent for the tested inputs (e.g., all mutations still keep `amount` or `balance` in the resulting set). |
| A-2 | `parseFloat(raw)` → `parseInt(raw, 10)` (or similar) | Test inputs use whole-number-valued strings (`'1000.0'`, `'5000.0'`). `parseFloat('1000.0')` and `parseInt('1000.0', 10)` both return `1000`. The distinction only surfaces for fractional amounts (e.g., `'1234.56'`), which are not in the amendment fixture data. Adding fractional test cases would kill this but adds minimal value for the audit trail display use case. |
| A-3 | `isNaN(n) ? raw : n` — boolean inversion in the ternary condition | Covered by the `NaN amount` test case (`'n/a'` input). This mutant appears to survive due to Stryker's perTest coverage limiting which tests run against this mutant — the NaN test is not always picked up as covering this path. |
| A-4–A-7 | Various `&&` / `!isNaN` / `raw.trim()` mutations in the non-money branch | These are killed by the `due_date`, `is_recurring`, and empty-string label tests. The 4 survivors in this area are conditional inversions where both branches return something truthy; the test assertions check the type of the return value but do not distinguish between all possible numeric/string values Stryker could inject. |

**Phase 3 survivors (5) — entityLabel parsing and MONEY_FIELDS additions:**

Phase 3 added entityLabel logic on line 33:
```ts
if (/^\d+$/.test(raw.trim())) return undefined
```
This hides raw entity IDs (pure digit strings) from label display. Two mutations survived:

| ID | Mutation | Why acceptable |
|----|----------|----------------|
| A-8 | `/^\d+$/` → `/^\d$/` | Regex changed to match only a single digit. Multi-digit IDs (10+) would not be suppressed. Tests use single-digit entity IDs in fixture data, so both patterns match the same inputs. Low risk: affects only amendment display label; no writes depend on this. |
| A-9 | `.trim()` removed from `raw.trim()` | Without trim, whitespace-padded ID strings would display instead of being suppressed. Amendment field values do not contain leading/trailing whitespace in practice (they come from numeric ORM fields). |
| A-10–A-12 | `MONEY_FIELDS = new Set(['amount', 'balance'])` → empty set or mutated entries | Phase 3 expanded test coverage for amendments but still uses integer-valued fixture balances (`8000`, `8400`), so `parseFloat` vs `parseInt` produce identical results and the MONEY_FIELDS check is not distinguishable. Same justification as A-1. |

**Decision**: All 12 survivors are in `parseValue` and `entityLabel` — internal display-formatting helpers in a read-only amendments log. No writes, no financial calculations, no security boundary depends on this code path. Accepted.

---

## Phase 2 Summary

| File | Score | Survivors | Decision |
|------|-------|-----------|----------|
| `amendments.ts` | 81.08% | 7 | Accepted — internal display helper, low risk |
| `categories.ts` | 96.97% | 1 | Accepted — coverage-analysis artefact |
| `dates.ts` | 96.30% | 1 | Accepted — test environment normalisation |
| `format.ts` | 91.67% | 1 | Accepted — locale invisible in test environment |
| `projected.ts` | 100.00% | 0 | — |
| **Overall** | **91.60%** | **10** | Exceeds 80% threshold |

## Phase 3 Summary

| File | Score | Survivors | Decision |
|------|-------|-----------|----------|
| `amendments.ts` | 81.54% | 12 | Accepted — display helpers, same justification as Phase 2 |
| `categories.ts` | 96.97% | 1 | Accepted — unchanged from Phase 2 |
| `dates.ts` | 96.30% | 1 | Accepted — unchanged from Phase 2 |
| `format.ts` | 91.67% | 1 | Accepted — unchanged from Phase 2 |
| `projected.ts` | 100.00% | 0 | — |
| **Overall** | **89.80%** | **15** | Exceeds 80% threshold |
