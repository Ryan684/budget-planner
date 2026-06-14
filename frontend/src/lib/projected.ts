export interface CarryRow {
  source_type: 'income' | 'bill'
  source_id: number
  label: string
  amount: number
  category?: string | null
  excluded: boolean
}

export function calcProjectedSurplus(rows: CarryRow[]): number {
  let surplus = 0
  for (const row of rows) {
    if (row.excluded) continue
    surplus += row.source_type === 'income' ? row.amount : -row.amount
  }
  return surplus
}
