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

// Old records stored a plain entity ID (e.g. "5") for lifecycle events.
// Skip those — only show the descriptive summary written by newer code.
function getLifecycleValue(raw: string | null): string | undefined {
  if (raw === null) return undefined
  if (/^\d+$/.test(raw.trim())) return undefined
  return raw
}

export function mapAmendment(a: AmendmentRead): AmendmentView {
  const verb =
    a.field_changed === 'created'
      ? 'Created'
      : a.field_changed === 'deleted'
        ? 'Removed'
        : `Updated ${a.field_changed}`

  const isLifecycle = a.field_changed === 'created' || a.field_changed === 'deleted'

  return {
    id: a.id,
    verb,
    entityType: a.entity_type,
    sourceLabel: a.source === 'claude' ? 'Claude' : 'You',
    from: a.field_changed === 'deleted'
      ? getLifecycleValue(a.old_value)
      : (isLifecycle ? undefined : parseValue(a.field_changed, a.old_value)),
    to: a.field_changed === 'created'
      ? getLifecycleValue(a.new_value)
      : (isLifecycle ? undefined : parseValue(a.field_changed, a.new_value)),
    reason: a.reason,
    tsLocal: fmtTimestamp(a.amended_at),
  }
}
