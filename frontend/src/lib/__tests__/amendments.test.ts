import { describe, it, expect } from 'vitest'
import { mapAmendment } from '../amendments'
import type { AmendmentRead } from '../../api/types'

const base: AmendmentRead = {
  id: 1,
  month_id: 1,
  entity_type: 'income',
  entity_id: 10,
  field_changed: 'amount',
  old_value: '1000.0',
  new_value: '1500.0',
  reason: 'Pay rise',
  source: 'user',
  amended_at: '2024-06-15T10:00:00Z',
}

describe('mapAmendment verb', () => {
  it('maps "created" field_changed to "Created"', () => {
    const a = mapAmendment({ ...base, field_changed: 'created', old_value: null, new_value: null })
    expect(a.verb).toBe('Created')
  })

  it('maps "deleted" field_changed to "Removed"', () => {
    const a = mapAmendment({ ...base, field_changed: 'deleted', old_value: null, new_value: null })
    expect(a.verb).toBe('Removed')
  })

  it('maps a named field to "Updated {field}"', () => {
    const a = mapAmendment({ ...base, field_changed: 'amount' })
    expect(a.verb).toBe('Updated amount')
  })

  it('maps "label" field to "Updated label"', () => {
    const a = mapAmendment({ ...base, field_changed: 'label', old_value: 'Old name', new_value: 'New name' })
    expect(a.verb).toBe('Updated label')
  })
})

describe('mapAmendment source chip', () => {
  it('maps "user" source to "You"', () => {
    const a = mapAmendment({ ...base, source: 'user' })
    expect(a.sourceLabel).toBe('You')
  })

  it('maps "claude" source to "Claude"', () => {
    const a = mapAmendment({ ...base, source: 'claude' })
    expect(a.sourceLabel).toBe('Claude')
  })
})

describe('mapAmendment money values', () => {
  it('parses numeric string old/new values for money fields', () => {
    const a = mapAmendment({ ...base, field_changed: 'amount', old_value: '1000.0', new_value: '1500.0' })
    expect(a.from).toBe(1000)
    expect(a.to).toBe(1500)
  })

  it('leaves from/to undefined when values are null', () => {
    const a = mapAmendment({ ...base, field_changed: 'created', old_value: null, new_value: null })
    expect(a.from).toBeUndefined()
    expect(a.to).toBeUndefined()
  })

  it('parses non-money field as string if not numeric', () => {
    const a = mapAmendment({ ...base, field_changed: 'label', old_value: 'Rent', new_value: 'Mortgage' })
    expect(a.from).toBe('Rent')
    expect(a.to).toBe('Mortgage')
  })
})

describe('mapAmendment timestamp', () => {
  it('produces a non-empty local timestamp string', () => {
    const a = mapAmendment(base)
    expect(typeof a.tsLocal).toBe('string')
    expect(a.tsLocal.length).toBeGreaterThan(0)
  })
})

describe('mapAmendment reason', () => {
  it('passes through the reason string', () => {
    const a = mapAmendment({ ...base, reason: 'Pay rise' })
    expect(a.reason).toBe('Pay rise')
  })

  it('handles null reason', () => {
    const a = mapAmendment({ ...base, reason: null })
    expect(a.reason).toBeNull()
  })
})
