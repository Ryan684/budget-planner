// ── Enums ──
export type AccountType = 'current' | 'savings'
export type EntityType = 'bill' | 'income' | 'account_balance'
export type Source = 'user' | 'claude'

// ── Income ──
export interface IncomeRead {
  id: number
  month_id: number
  label: string
  amount: number
  is_recurring: boolean
}
export interface IncomeCreate {
  label: string
  amount: number
  is_recurring?: boolean
}
export interface IncomeUpdate {
  label?: string
  amount?: number
  is_recurring?: boolean
}

// ── Bills ──
export interface BillRead {
  id: number
  month_id: number
  label: string
  amount: number
  category: string
  is_recurring: boolean
  due_date: number | null
}
export interface BillCreate {
  label: string
  amount: number
  category: string
  is_recurring?: boolean
  due_date?: number | null
}
export interface BillUpdate {
  label?: string
  amount?: number
  category?: string
  is_recurring?: boolean
  due_date?: number | null
}

// ── Accounts (not month-scoped) ──
export interface AccountRead {
  id: number
  label: string
  balance: number
  account_type: AccountType
  as_of_date: string // ISO date "YYYY-MM-DD"
  notes: string | null
}
export interface AccountCreate {
  label: string
  balance: number
  account_type?: AccountType
  as_of_date?: string | null
  notes?: string | null
  active_month_id?: number | null
}
export interface AccountUpdate {
  label?: string
  balance?: number
  account_type?: AccountType
  as_of_date?: string | null
  notes?: string | null
  active_month_id?: number | null
}
export interface AccountList {
  accounts: AccountRead[]
  total_balances: number
  total_savings: number
}

// ── Months / budget ──
export interface MonthRead {
  id: number
  month: string // "YYYY-MM"
  notes: string | null
  created_at: string // ISO UTC
  updated_at: string // ISO UTC
}
export interface MonthUpdate {
  notes?: string | null
}
export interface BudgetSummary {
  month_id: number
  month: string
  total_income: number
  total_bills: number
  monthly_surplus: number
  total_balances: number
  total_savings: number
}
export interface MonthDetail {
  month: MonthRead
  income: IncomeRead[]
  bills: BillRead[]
  summary: BudgetSummary
}

export interface CarryForwardOverride {
  source_type: 'income' | 'bill'
  source_id: number
  amount?: number | null
  exclude?: boolean
}
export interface MonthCreate {
  month: string
  notes?: string | null
  carry_forward?: boolean
  overrides?: CarryForwardOverride[]
}
export interface CarryForwardItem {
  source_type: 'income' | 'bill'
  source_id: number
  label: string
  amount: number
  category: string | null
}
export interface CarryForwardPreview {
  from_month: string | null
  income: CarryForwardItem[]
  bills: CarryForwardItem[]
}

// ── Amendments (read-only log) ──
export interface AmendmentRead {
  id: number
  month_id: number | null
  entity_type: EntityType
  entity_id: number
  field_changed: string // "created" | "deleted" | a field name e.g. "amount"
  old_value: string | null // stringified by the API
  new_value: string | null // stringified by the API
  reason: string | null
  source: Source
  amended_at: string // ISO UTC
}
