import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountsScreen } from '../Accounts'

vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: vi.fn(),
}))
vi.mock('../../api/accounts', () => ({
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}))

import { useAccounts } from '../../hooks/useAccounts'
import { createAccount } from '../../api/accounts'

const mockRefetch = vi.fn()

const freshDate = new Date()
freshDate.setDate(freshDate.getDate() - 5)
const freshIso = freshDate.toISOString().slice(0, 10)

const staleDate = new Date()
staleDate.setDate(staleDate.getDate() - 35)
const staleIso = staleDate.toISOString().slice(0, 10)

const baseAccounts = {
  data: {
    accounts: [
      { id: 1, label: 'Current', balance: 2300, account_type: 'current' as const, as_of_date: freshIso, notes: null },
      { id: 2, label: 'Savings', balance: 8400, account_type: 'savings' as const, as_of_date: freshIso, notes: null },
      { id: 3, label: 'Old account', balance: 12000, account_type: 'current' as const, as_of_date: staleIso, notes: null },
    ],
    total_balances: 22700,
    total_savings: 8400,
  },
  loading: false,
  error: null,
  refetch: mockRefetch,
}

beforeEach(() => {
  vi.mocked(useAccounts).mockReturnValue(baseAccounts)
  vi.mocked(createAccount).mockResolvedValue({
    id: 4, label: 'New', balance: 500, account_type: 'current', as_of_date: freshIso, notes: null,
  })
})

function renderAccounts(props: { editableMonthId?: number } = {}) {
  render(
    <AccountsScreen editableMonthId={props.editableMonthId ?? 1} />
  )
}

describe('Accounts list', () => {
  it('shows total across all accounts', async () => {
    renderAccounts()
    await waitFor(() => expect(screen.getByText('£22,700.00')).toBeTruthy())
  })

  it('shows account labels', async () => {
    renderAccounts()
    await waitFor(() => {
      expect(screen.getByText('Current')).toBeTruthy()
      expect(screen.getByText('Savings')).toBeTruthy()
    })
  })

  it('shows the Stale pill for a >30-day balance', async () => {
    renderAccounts()
    await waitFor(() => expect(screen.getByText('Stale')).toBeTruthy())
  })

  it('shows the stale banner count', async () => {
    renderAccounts()
    await waitFor(() => expect(screen.getByText(/not updated in over 30 days/i)).toBeTruthy())
  })

  it('shows the add button', async () => {
    renderAccounts()
    await waitFor(() => {
      const addBtns = screen.getAllByRole('button', { name: /add account/i })
      expect(addBtns.length).toBeGreaterThan(0)
    })
  })
})

describe('Accounts empty state', () => {
  it('shows empty state when there are no accounts', async () => {
    vi.mocked(useAccounts).mockReturnValue({
      ...baseAccounts,
      data: { accounts: [], total_balances: 0, total_savings: 0 },
    })
    renderAccounts()
    await waitFor(() => expect(screen.getByText(/no balances recorded/i)).toBeTruthy())
  })
})

describe('Accounts add flow', () => {
  it('calls createAccount and refetches on successful submit', async () => {
    const user = userEvent.setup()
    renderAccounts()
    await waitFor(() => screen.getAllByRole('button', { name: /add account/i }))
    const addBtns = screen.getAllByRole('button', { name: /add account/i })
    await user.click(addBtns[addBtns.length - 1])

    await user.type(screen.getByPlaceholderText(/joint savings/i), 'ISA')
    const amtInput = screen.getByRole('spinbutton')
    await user.clear(amtInput)
    await user.type(amtInput, '500')

    const submitBtns = screen.getAllByRole('button', { name: 'Add account' })
    await user.click(submitBtns[submitBtns.length - 1])

    await waitFor(() => {
      expect(createAccount).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'ISA', balance: 500, active_month_id: 1 })
      )
      expect(mockRefetch).toHaveBeenCalled()
    })
  })
})
