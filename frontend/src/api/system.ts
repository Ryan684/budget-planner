import { apiFetch } from './client'
import type { BackupStatus } from './types'

/** Health of the last nightly backup, derived from the Pi's run log. */
export function getBackupStatus(): Promise<BackupStatus> {
  return apiFetch('/backup-status')
}
