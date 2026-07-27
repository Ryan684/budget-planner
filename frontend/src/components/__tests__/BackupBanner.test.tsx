import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
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

/**
 * Assert no banner *after* the status fetch has settled and React has flushed —
 * querying too early would pass regardless of the banner logic.
 */
async function expectNoBanner(): Promise<void> {
  await waitFor(() => expect(mockGetBackupStatus).toHaveBeenCalled())
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.queryByRole('status')).toBeNull()
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

    await expectNoBanner()
  })

  it('shows nothing when the status is unknown, as in development', async () => {
    renderBanner({ status: 'unknown', last_run_at: null, stale: false })

    await expectNoBanner()
  })

  it('shows nothing when the status cannot be fetched', async () => {
    mockGetBackupStatus.mockRejectedValue(new Error('Failed to fetch'))
    render(<BackupBanner />)

    await expectNoBanner()
  })
})

describe('BackupBanner detail', () => {
  it('names when the failed run happened', async () => {
    renderBanner({ status: 'failed', last_run_at: RUN_AT, stale: false })

    expect(await screen.findByRole('status')).toHaveTextContent(/26 Jul/)
  })

  it('names when the last successful run happened', async () => {
    renderBanner({ status: 'success', last_run_at: RUN_AT, stale: true })

    expect(await screen.findByRole('status')).toHaveTextContent(/26 Jul/)
  })

  it('copes with a failure that has no recorded timestamp', async () => {
    renderBanner({ status: 'failed', last_run_at: null, stale: false })

    expect(await screen.findByRole('status')).toHaveTextContent(/unknown time/i)
  })

  it('shows nothing for an unknown status even if it were flagged stale', async () => {
    // Staleness only qualifies a success; unknown must never raise a banner.
    renderBanner({ status: 'unknown', last_run_at: null, stale: true })

    await expectNoBanner()
  })
})
