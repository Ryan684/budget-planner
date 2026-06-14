import { useState, useEffect, useCallback } from 'react'
import { listAmendments } from '../api/amendments'
import type { AmendmentRead } from '../api/types'

export interface UseAmendmentsResult {
  data: AmendmentRead[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAmendments(monthId: number | null): UseAmendmentsResult {
  const [data, setData] = useState<AmendmentRead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (monthId === null) {
      setData([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    listAmendments(monthId)
      .then(d => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load amendments')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [monthId, version])

  const refetch = useCallback(() => setVersion(v => v + 1), [])

  return { data, loading, error, refetch }
}
