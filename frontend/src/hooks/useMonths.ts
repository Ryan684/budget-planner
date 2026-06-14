import { useState, useEffect, useCallback } from 'react'
import { listMonths } from '../api/months'
import type { MonthRead } from '../api/types'

export interface UseMonthsResult {
  months: MonthRead[]
  editableMonthId: number | null
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

  const editableMonthId =
    months.length > 0
      ? months.reduce((max, m) => (m.month > max.month ? m : max)).id
      : null

  const isReadOnly = useCallback(
    (monthId: number) => monthId !== editableMonthId,
    [editableMonthId],
  )

  return { months, editableMonthId, loading, error, refetch, isReadOnly }
}
