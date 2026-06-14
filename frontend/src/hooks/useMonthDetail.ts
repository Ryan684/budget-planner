import { useState, useEffect, useCallback } from 'react'
import { monthDetail } from '../api/months'
import type { MonthDetail } from '../api/types'

export interface UseMonthDetailResult {
  data: MonthDetail | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useMonthDetail(monthId: number | null): UseMonthDetailResult {
  const [data, setData] = useState<MonthDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (monthId === null) {
      setData(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    monthDetail(monthId)
      .then(d => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load month detail')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [monthId, version])

  const refetch = useCallback(() => setVersion(v => v + 1), [])

  return { data, loading, error, refetch }
}
