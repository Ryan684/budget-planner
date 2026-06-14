import { describe, it, expect, vi, afterEach } from 'vitest'
import { daysAgo, isStale, nextMonthString, fmtAsOf } from '../dates'

const FAKE_NOW = new Date('2024-06-15T12:00:00Z')

afterEach(() => {
  vi.useRealTimers()
})

describe('daysAgo', () => {
  it('returns 0 for today', () => {
    vi.setSystemTime(FAKE_NOW)
    expect(daysAgo('2024-06-15')).toBe(0)
  })

  it('returns 1 for yesterday', () => {
    vi.setSystemTime(FAKE_NOW)
    expect(daysAgo('2024-06-14')).toBe(1)
  })

  it('returns 30 for 30 days ago', () => {
    vi.setSystemTime(FAKE_NOW)
    expect(daysAgo('2024-05-16')).toBe(30)
  })

  it('returns 45 for 45 days ago', () => {
    vi.setSystemTime(FAKE_NOW)
    expect(daysAgo('2024-05-01')).toBe(45)
  })
})

describe('isStale', () => {
  it('returns false for 29 days ago', () => {
    vi.setSystemTime(FAKE_NOW)
    expect(isStale('2024-05-17')).toBe(false)
  })

  it('returns true for exactly 30 days ago', () => {
    vi.setSystemTime(FAKE_NOW)
    expect(isStale('2024-05-16')).toBe(true)
  })

  it('returns true for 31 days ago', () => {
    vi.setSystemTime(FAKE_NOW)
    expect(isStale('2024-05-15')).toBe(true)
  })
})

describe('nextMonthString', () => {
  it('increments month within the year', () => {
    expect(nextMonthString('2024-06')).toBe('2024-07')
  })

  it('wraps December to January of next year', () => {
    expect(nextMonthString('2024-12')).toBe('2025-01')
  })

  it('pads single-digit months with zero', () => {
    expect(nextMonthString('2024-01')).toBe('2024-02')
  })
})

describe('fmtAsOf', () => {
  it('labels today as "Updated today"', () => {
    vi.setSystemTime(FAKE_NOW)
    expect(fmtAsOf('2024-06-15')).toBe('Updated today')
  })

  it('labels yesterday as "Updated yesterday"', () => {
    vi.setSystemTime(FAKE_NOW)
    expect(fmtAsOf('2024-06-14')).toBe('Updated yesterday')
  })

  it('labels N days ago numerically', () => {
    vi.setSystemTime(FAKE_NOW)
    expect(fmtAsOf('2024-06-12')).toBe('Updated 3 days ago')
  })

  it('labels 30 days ago with stale wording', () => {
    vi.setSystemTime(FAKE_NOW)
    expect(fmtAsOf('2024-05-16')).toBe('Updated 30 days ago')
  })
})
