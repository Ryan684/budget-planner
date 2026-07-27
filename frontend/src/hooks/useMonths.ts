import { useState, useEffect, useCallback } from 'react'
import { listMonths } from '../api/months'
import { currentMonthKey } from '../lib/dates'
import type { MonthRead } from '../api/types'

export interface UseMonthsResult {
  months: MonthRead[]
  /** The month matching the current calendar month — null if it does not exist yet. */
  editableMonthId: number | null
  /** The newest month on file, for viewing when there is no editable month. */
  latestMonthId: number | null
  loading: boolean
  error: string | null
  refetch: () => void
  isReadOnly: (monthId: number) => boolean
}

export function useMonths(): UseMonthsResult {
  const [months, setMonths] = useState<MonthRead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listMonths()
      .then(data => {
        if (!cancelled) {
          setMonths(data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load months')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [version])

  const refetch = useCallback(() => setVersion(v => v + 1), [])

  // The editable month is the calendar month, not the latest one: a future-dated
  // month must stay read-only until its month arrives, and a missing current
  // month means nothing is editable until it is created.
  const editableMonthId = months.find(m => m.month === currentMonthKey())?.id ?? null

  const latestMonthId =
    months.length > 0
      ? months.reduce((max, m) => (m.month > max.month ? m : max)).id
      : null

  const isReadOnly = useCallback(
    (monthId: number) => monthId !== editableMonthId,
    [editableMonthId],
  )

  return { months, editableMonthId, latestMonthId, loading, error, refetch, isReadOnly }
}
