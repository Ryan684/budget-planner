import { useState, useEffect, useCallback } from 'react'
import { pinRequired, verifyPin } from '../api/auth'

/** Session-scoped unlock marker. Cleared when the browser session ends (FR-003). */
const UNLOCK_KEY = 'budget-planner:unlocked'

export type PinGateStatus = 'checking' | 'locked' | 'unlocked'

export interface UsePinGateResult {
  status: PinGateStatus
  /** The gate check itself failed — retryable, and it must stay locked (FR-004). */
  loadError: string | null
  /** A wrong PIN, or a failed attempt the user can simply repeat. */
  verifyError: string | null
  verifying: boolean
  verify: (pin: string) => Promise<void>
  retry: () => void
}

function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

function markUnlocked(): void {
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1')
  } catch {
    // A browser refusing sessionStorage just means re-entry after a reload.
  }
}

/**
 * Drives the PIN lock screen. The PIN is checked by the backend, so the
 * configured value never reaches the bundle (FR-005a); only the fact that the
 * session is unlocked is kept here.
 *
 * Fails closed: if the `pin-required` check cannot be reached we stay locked
 * with a retryable error rather than revealing the app.
 */
export function usePinGate(): UsePinGateResult {
  const [status, setStatus] = useState<PinGateStatus>(() =>
    isUnlocked() ? 'unlocked' : 'checking',
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (isUnlocked()) {
      setStatus('unlocked')
      return
    }
    let cancelled = false
    setStatus('checking')
    setLoadError(null)
    pinRequired()
      .then(res => {
        if (cancelled) return
        setStatus(res.required ? 'locked' : 'unlocked')
      })
      .catch(() => {
        if (cancelled) return
        setLoadError('Could not reach the app. Check the connection and try again.')
        setStatus('locked')
      })
    return () => {
      cancelled = true
    }
  }, [version])

  const verify = useCallback(async (pin: string) => {
    setVerifyError(null)
    setVerifying(true)
    try {
      const res = await verifyPin(pin)
      if (res.ok) {
        markUnlocked()
        setStatus('unlocked')
      } else {
        setVerifyError('Incorrect PIN')
      }
    } catch {
      setVerifyError('Could not reach the app. Please try again.')
    } finally {
      setVerifying(false)
    }
  }, [])

  const retry = useCallback(() => setVersion(v => v + 1), [])

  return { status, loadError, verifyError, verifying, verify, retry }
}
