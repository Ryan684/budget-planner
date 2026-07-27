import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { usePinGate } from '../hooks/usePinGate'
import { Button } from './Button'
import { StateView } from './StateView'
import styles from './PinGate.module.css'

interface PinGateProps {
  children: ReactNode
}

/**
 * Access lock shown on load when a PIN is configured (FR-001). Children — the
 * whole app — are not rendered until the session is unlocked, so no financial
 * data is fetched, let alone displayed, behind the gate.
 */
export function PinGate({ children }: PinGateProps) {
  const { status, loadError, verifyError, verifying, verify, retry } = usePinGate()
  const [pin, setPin] = useState('')

  if (status === 'unlocked') return <>{children}</>
  if (status === 'checking') return <StateView loading />

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void verify(pin)
    // The entry is left in place so a failed attempt can be corrected and
    // resubmitted without retyping.
  }

  if (loadError) {
    return (
      <div className={styles.root}>
        <div className={styles.panel}>
          <StateView error={loadError} onRetry={retry} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <form className={styles.panel} onSubmit={onSubmit}>
        <h1 className={styles.title}>Budget Planner</h1>
        <p className={styles.hint}>Enter your PIN to unlock</p>
        <input
          id="pin"
          className={styles.input}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={e => setPin(e.target.value)}
          aria-label="PIN"
        />
        {verifyError && (
          <p className={styles.error} role="alert">
            {verifyError}
          </p>
        )}
        <Button type="submit" full disabled={verifying || pin === ''}>
          {verifying ? 'Checking…' : 'Unlock'}
        </Button>
      </form>
    </div>
  )
}
