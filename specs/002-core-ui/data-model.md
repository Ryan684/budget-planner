# Phase 1 Design — Data Model (Frontend Types & View Models)

Phase 2 introduces **no persisted entities**. These are the TypeScript types the frontend uses,
mirroring the Phase 1 Pydantic schemas (`backend/schemas.py`) exactly — API field names are kept
verbatim (`is_recurring`, `due_date`, `as_of_date`, `account_type`); display renaming happens only
in components. All money is `number` (GBP float). `strict` TS, no `any`.

## Source-of-truth API types (`src/api/types.ts`)

```ts
// ── Enums ──
export type AccountType = "current" | "savings";
export type EntityType = "bill" | "income" | "account_balance";
export type Source = "user" | "claude";

// ── Income ──
export interface IncomeRead { id: number; month_id: number; label: string; amount: number; is_recurring: boolean; }
export interface IncomeCreate { label: string; amount: number; is_recurring?: boolean; }
export interface IncomeUpdate { label?: string; amount?: number; is_recurring?: boolean; }

// ── Bills ──
export interface BillRead { id: number; month_id: number; label: string; amount: number; category: string; is_recurring: boolean; due_date: number | null; }
export interface BillCreate { label: string; amount: number; category: string; is_recurring?: boolean; due_date?: number | null; }
export interface BillUpdate { label?: string; amount?: number; category?: string; is_recurring?: boolean; due_date?: number | null; }

// ── Accounts (not month-scoped) ──
export interface AccountRead { id: number; label: string; balance: number; account_type: AccountType; as_of_date: string; notes: string | null; } // as_of_date: ISO date
export interface AccountCreate { label: string; balance: number; account_type?: AccountType; as_of_date?: string | null; notes?: string | null; active_month_id?: number | null; }
export interface AccountUpdate { label?: string; balance?: number; account_type?: AccountType; as_of_date?: string | null; notes?: string | null; active_month_id?: number | null; }
export interface AccountList { accounts: AccountRead[]; total_balances: number; total_savings: number; }

// ── Months / budget ──
export interface MonthRead { id: number; month: string; notes: string | null; created_at: string; updated_at: string; } // month: "YYYY-MM"; timestamps: ISO UTC
export interface MonthUpdate { notes?: string | null; }
export interface BudgetSummary { month_id: number; month: string; total_income: number; total_bills: number; monthly_surplus: number; total_balances: number; total_savings: number; }
export interface MonthDetail { month: MonthRead; income: IncomeRead[]; bills: BillRead[]; summary: BudgetSummary; }

export interface CarryForwardOverride { source_type: "income" | "bill"; source_id: number; amount?: number | null; exclude?: boolean; }
export interface MonthCreate { month: string; notes?: string | null; carry_forward?: boolean; overrides?: CarryForwardOverride[]; }
export interface CarryForwardItem { source_type: "income" | "bill"; source_id: number; label: string; amount: number; category: string | null; }
export interface CarryForwardPreview { from_month: string | null; income: CarryForwardItem[]; bills: CarryForwardItem[]; }

// ── Amendments (read-only log) ──
export interface AmendmentRead {
  id: number; month_id: number | null; entity_type: EntityType; entity_id: number;
  field_changed: string;            // "created" | "deleted" | a field name e.g. "amount"
  old_value: string | null;         // stringified by the API
  new_value: string | null;         // stringified by the API
  reason: string | null; source: Source; amended_at: string; // ISO UTC
}
```

## Derived view models / helpers (client-only, never persisted)

| View model | Where | Shape / purpose |
|---|---|---|
| **EditableMonth** | `useMonths` | `months.reduce(max by .month)` → the latest month is editable; all earlier ones are read-only. Also exposes `isReadOnly(monthId)`. |
| **CategoryGroup** | Bills screen | `{ category: string; dot: string; bills: BillRead[]; subtotal: number }[]`, ordered by the suggested category order then alphabetical; bills sorted by `due_date` (nulls last) within a group. |
| **AccountView** | Accounts screen | `AccountRead & { isStale: boolean; asOfLabel: string }` where `isStale = daysAgo(as_of_date) >= 30`, `asOfLabel = "Updated …"`. |
| **CarryRow** | Create-month | `{ source_type; source_id; label; amount; category? ; excluded: boolean }` editable in the UI; on confirm becomes `MonthCreate.overrides` + `carry_forward: true`. |
| **AmendmentView** | Amendments screen | `{ verb: "Created"|"Updated"|"Removed"; targetLabel: string; from?: number|string; to?: number|string; reason?: string; tsLocal: string }` derived from `field_changed`, `old_value`, `new_value`, `amended_at`. |
| **ProjectedSurplus** | Create-month | pure `sum(includedIncome) − sum(includedBills)` over carry rows — a **preview only**, written to nothing; live figures still come from the API after creation. |

## Validation rules (client, mirroring the API)

- `label`: required, non-empty after trim.
- `amount` / `balance`: required, numeric, `>= 0` (negatives rejected before submit; API also enforces `ge=0`).
- `due_date`: optional integer `1..31` (API enforces `ge=1, le=31`).
- `month` (create): `^\d{4}-\d{2}$`; duplicate → API `409`, shown as "month already exists".
- Account save sets `as_of_date` to today (server default when omitted); edits move it to today.

## Field-name & display mapping (API → prototype)

| API field | Prototype/UI display |
|---|---|
| `is_recurring` | "Recurring" toggle / recurring icon |
| `due_date` (int) | "Due {n}{st/nd/rd/th}" within category |
| `as_of_date` (ISO) | "Updated N days ago" + "Stale" pill at ≥30d |
| `account_type` | not shown this phase (defaults `current`) |
| `monthly_surplus` | "Monthly surplus" hero + receipt card |
| `total_balances` | "Total across all accounts" |
| `field_changed` `created`/`deleted` | verbs "Created"/"Removed" |
