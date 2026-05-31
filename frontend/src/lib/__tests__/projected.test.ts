import { describe, it, expect } from 'vitest'
import { calcProjectedSurplus } from '../projected'
import type { CarryRow } from '../projected'

describe('calcProjectedSurplus', () => {
  const rows: CarryRow[] = [
    { source_type: 'income', source_id: 1, label: 'Salary', amount: 3000, excluded: false },
    { source_type: 'income', source_id: 2, label: 'Freelance', amount: 500, excluded: false },
    { source_type: 'bill', source_id: 3, label: 'Rent', amount: 1200, excluded: false },
    { source_type: 'bill', source_id: 4, label: 'Gym', amount: 50, excluded: false },
  ]

  it('computes surplus as income minus bills', () => {
    expect(calcProjectedSurplus(rows)).toBe(2250)
  })

  it('excludes unticked income rows from the sum', () => {
    const r = [...rows]
    r[0] = { ...r[0], excluded: true }
    expect(calcProjectedSurplus(r)).toBe(-750)
  })

  it('excludes unticked bill rows from the sum', () => {
    const r = [...rows]
    r[2] = { ...r[2], excluded: true }
    expect(calcProjectedSurplus(r)).toBe(3450)
  })

  it('returns zero when all rows excluded', () => {
    const r = rows.map(row => ({ ...row, excluded: true }))
    expect(calcProjectedSurplus(r)).toBe(0)
  })

  it('returns 0 for empty rows', () => {
    expect(calcProjectedSurplus([])).toBe(0)
  })

  it('handles negative surplus when bills exceed income', () => {
    const r: CarryRow[] = [
      { source_type: 'income', source_id: 1, label: 'Salary', amount: 500, excluded: false },
      { source_type: 'bill', source_id: 2, label: 'Rent', amount: 1200, excluded: false },
    ]
    expect(calcProjectedSurplus(r)).toBe(-700)
  })
})
