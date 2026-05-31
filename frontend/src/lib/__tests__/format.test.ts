import { describe, it, expect } from 'vitest'
import { gbp, fmtTimestamp } from '../format'

describe('gbp', () => {
  it('formats whole pounds', () => {
    expect(gbp(100)).toBe('£100.00')
  })

  it('formats with pence', () => {
    expect(gbp(1234.56)).toBe('£1,234.56')
  })

  it('formats thousands', () => {
    expect(gbp(10000)).toBe('£10,000.00')
  })

  it('formats zero', () => {
    expect(gbp(0)).toBe('£0.00')
  })

  it('formats negative with leading minus', () => {
    expect(gbp(-99.5)).toBe('-£99.50')
  })

  it('formats negative thousands', () => {
    expect(gbp(-1500)).toBe('-£1,500.00')
  })

  it('does not use parentheses for negatives', () => {
    expect(gbp(-10)).not.toContain('(')
    expect(gbp(-10)).not.toContain(')')
  })

  it('rounds to two decimal places', () => {
    expect(gbp(1.005)).toBe('£1.01')
  })
})

describe('fmtTimestamp', () => {
  it('returns a non-empty string for a valid ISO timestamp', () => {
    const result = fmtTimestamp('2024-01-15T10:30:00Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('produces a local-time formatted string', () => {
    // Just verify it does not throw and returns something
    const result = fmtTimestamp('2024-06-01T00:00:00Z')
    expect(result).toBeTruthy()
  })
})
