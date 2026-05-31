import { useState, useEffect, useCallback } from 'react'
import { listAccounts } from '../api/accounts'
import type { AccountList } from '../api/types'

export interface UseAccountsResult {
  data: AccountList | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAccounts(): UseAccountsResult {
  const [data, setData] = useState<AccountList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listAccounts()
      .then(d => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load accounts')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [version])

  const refetch = useCallback(() => setVersion(v => v + 1), [])

  return { data, loading, error, refetch }
}
