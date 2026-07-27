import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BackupBanner } from '../BackupBanner'
import type { BackupStatus } from '../../api/types'

vi.mock('../../api/system', () => ({
  getBackupStatus: vi.fn(),
}))

import { getBackupStatus } from '../../api/system'

const mockGetBackupStatus = vi.mocked(getBackupStatus)

const RUN_AT = '2026-07-26T02:30:00Z'

function renderBanner(status: BackupStatus) {
  mockGetBackupStatus.mockResolvedValue(status)
  render(<BackupBanner />)
}

async function bannerText(): Promise<string | null> {
  // Give the status fetch a chance to resolve before asserting absence.
  await Promise.resolve()
  const banner = screen.queryByRole('status')
  return banner?.textContent ?? null
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BackupBanner', () => {
  it('warns when the last backup failed', async () => {
    renderBanner({ status: 'failed', last_run_at: RUN_AT, stale: false })

    expect(await screen.findByRole('status')).toHaveTextContent(/last backup failed/i)
  })

  it('warns when the last successful backup is stale', async () => {
    renderBanner({ status: 'success', last_run_at: RUN_AT, stale: true })

    expect(await screen.findByRole('status')).toHaveTextContent(/no successful backup/i)
  })

  it('shows nothing when the last backup succeeded recently', async () => {
    renderBanner({ status: 'success', last_run_at: RUN_AT, stale: false })

    expect(await bannerText()).toBeNull()
  })

  it('shows nothing when the status is unknown, as in development', async () => {
    renderBanner({ status: 'unknown', last_run_at: null, stale: false })

    expect(await bannerText()).toBeNull()
  })

  it('shows nothing when the status cannot be fetched', async () => {
    mockGetBackupStatus.mockRejectedValue(new Error('Failed to fetch'))
    render(<BackupBanner />)

    expect(await bannerText()).toBeNull()
  })
})
