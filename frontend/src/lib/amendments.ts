import { fmtTimestamp } from './format'
import type { AmendmentRead } from '../api/types'

const MONEY_FIELDS = new Set(['amount', 'balance'])

export interface AmendmentView {
  id: number
  verb: string
  entityType: string
  sourceLabel: 'You' | 'Claude'
  from: number | string | undefined
  to: number | string | undefined
  reason: string | null
  tsLocal: string
}

function parseValue(field: string, raw: string | null): number | string | undefined {
  if (raw === null) return undefined
  if (MONEY_FIELDS.has(field)) {
    const n = parseFloat(raw)
    return isNaN(n) ? raw : n
  }
  const n = Number(raw)
  return !isNaN(n) && raw.trim() !== '' ? n : raw
}

export function mapAmendment(a: AmendmentRead): AmendmentView {
  const verb =
    a.field_changed === 'created'
      ? 'Created'
      : a.field_changed === 'deleted'
        ? 'Removed'
        : `Updated ${a.field_changed}`

  return {
    id: a.id,
    verb,
    entityType: a.entity_type,
    sourceLabel: a.source === 'claude' ? 'Claude' : 'You',
    from: parseValue(a.field_changed, a.old_value),
    to: parseValue(a.field_changed, a.new_value),
    reason: a.reason,
    tsLocal: fmtTimestamp(a.amended_at),
  }
}
