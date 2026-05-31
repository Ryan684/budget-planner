import { describe, it, expect } from 'vitest'
import { SUGGESTED_CATEGORIES, getDot, categoryOrder } from '../categories'

describe('SUGGESTED_CATEGORIES', () => {
  it('has 6 entries', () => {
    expect(SUGGESTED_CATEGORIES.length).toBe(6)
  })

  it('contains Housing, Utilities, Childcare, Transport, Insurance, One-off', () => {
    const labels = SUGGESTED_CATEGORIES.map(c => c.label)
    expect(labels).toContain('Housing')
    expect(labels).toContain('Utilities')
    expect(labels).toContain('Childcare')
    expect(labels).toContain('Transport')
    expect(labels).toContain('Insurance')
    expect(labels).toContain('One-off')
  })

  it('each entry has a non-empty label and dot color', () => {
    for (const c of SUGGESTED_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.dot.length).toBeGreaterThan(0)
    }
  })
})

describe('getDot', () => {
  it('returns Housing dot color', () => {
    expect(getDot('Housing')).toBe('#3a4f82')
  })

  it('returns One-off dot color', () => {
    expect(getDot('One-off')).toBe('#c0392b')
  })

  it('returns fallback color for unknown category', () => {
    expect(getDot('Unknown')).toBe('#8b93a2')
  })

  it('is case-sensitive', () => {
    expect(getDot('housing')).toBe('#8b93a2')
  })
})

describe('categoryOrder', () => {
  it('returns 0 for Housing (first)', () => {
    expect(categoryOrder('Housing')).toBe(0)
  })

  it('returns 5 for One-off (last suggested)', () => {
    expect(categoryOrder('One-off')).toBe(5)
  })

  it('returns SUGGESTED_CATEGORIES.length for unknown categories', () => {
    expect(categoryOrder('Custom')).toBe(SUGGESTED_CATEGORIES.length)
  })

  it('maintains relative order: Housing before Utilities', () => {
    expect(categoryOrder('Housing')).toBeLessThan(categoryOrder('Utilities'))
  })
})
