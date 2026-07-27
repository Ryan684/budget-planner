import { useState, useEffect } from 'react'
import { getBackupStatus } from '../api/system'
import { Banner } from './Banner'
import type { BackupStatus } from '../api/types'

function fmtRunAt(iso: string | null): string {
  if (iso === null) return 'unknown time'
  const at = new Date(iso)
  return at.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Warns on the dashboard when the nightly backup failed or has gone stale
 * (FR-015). A status of `unknown` — no log, as in development — shows nothing,
 * and so does a fetch failure: the backup banner must never be the thing that
 * cries wolf (FR-016).
 */
export function BackupBanner() {
  const [status, setStatus] = useState<BackupStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    getBackupStatus()
      .then(s => {
        if (!cancelled) setStatus(s)
      })
      .catch(() => {
        // Silent: an unreachable status endpoint is not a backup failure.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (status === null) return null
  if (status.status === 'failed') {
    return (
      <Banner tone="red" icon="x">
        Last backup failed ({fmtRunAt(status.last_run_at)}). Check the Pi backup log.
      </Banner>
    )
  }
  if (status.status === 'success' && status.stale) {
    return (
      <Banner tone="amber" icon="dots">
        No successful backup since {fmtRunAt(status.last_run_at)}. Check the Pi backup timer.
      </Banner>
    )
  }
  return null
}
