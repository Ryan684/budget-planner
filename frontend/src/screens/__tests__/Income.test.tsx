import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IncomeScreen } from '../Income'

vi.mock('../../hooks/useMonthDetail', () => ({
  useMonthDetail: vi.fn(),
}))
vi.mock('../../api/income', () => ({
  createIncome: vi.fn(),
  updateIncome: vi.fn(),
  deleteIncome: vi.fn(),
}))

import { useMonthDetail } from '../../hooks/useMonthDetail'
import { createIncome, updateIncome, deleteIncome } from '../../api/income'

const mockRefetch = vi.fn()
const baseDetail = {
  data: {
    month: { id: 1, month: '2024-06', notes: null, created_at: '', updated_at: '' },
    income: [
      { id: 1, month_id: 1, label: 'Salary', amount: 3000, is_recurring: true },
      { id: 2, month_id: 1, label: 'Freelance', amount: 500, is_recurring: false },
    ],
    bills: [],
    summary: {
      month_id: 1, month: '2024-06',
      total_income: 3500, total_bills: 0, monthly_surplus: 3500,
      total_balances: 0, total_savings: 0,
    },
  },
  loading: false,
  error: null,
  refetch: mockRefetch,
}

beforeEach(() => {
  vi.mocked(useMonthDetail).mockReturnValue(baseDetail)
  vi.mocked(createIncome).mockResolvedValue({ id: 3, month_id: 1, label: 'New', amount: 200, is_recurring: false })
  vi.mocked(updateIncome).mockResolvedValue({ id: 1, month_id: 1, label: 'Salary', amount: 3200, is_recurring: true })
  vi.mocked(deleteIncome).mockResolvedValue(undefined)
})

function renderIncome(props: { readOnly?: boolean } = {}) {
  const onBack = vi.fn()
  render(
    <IncomeScreen
      activeMonthId={1}
      readOnly={props.readOnly ?? false}
      onBack={onBack}
    />
  )
  return { onBack }
}

describe('Income list', () => {
  it('shows total income', async () => {
    renderIncome()
    await waitFor(() => expect(screen.getByText('£3,500.00')).toBeTruthy())
  })

  it('shows income entries', async () => {
    renderIncome()
    await waitFor(() => {
      expect(screen.getByText('Salary')).toBeTruthy()
      expect(screen.getByText('Freelance')).toBeTruthy()
    })
  })

  it('shows the recurring indicator for recurring entries', async () => {
    renderIncome()
    await waitFor(() => expect(screen.getByText('Recurring')).toBeTruthy())
  })

  it('shows the add button in editable mode', async () => {
    renderIncome()
    await waitFor(() => {
      const btns = screen.getAllByRole('button', { name: /add income/i })
      expect(btns.length).toBeGreaterThan(0)
    })
  })
})

describe('Income read-only', () => {
  it('hides add button in read-only mode', async () => {
    renderIncome({ readOnly: true })
    await waitFor(() => expect(screen.queryByRole('button', { name: /add income/i })).toBeNull())
  })

  it('shows read-only banner', async () => {
    renderIncome({ readOnly: true })
    await waitFor(() => expect(screen.getByText(/read.only/i)).toBeTruthy())
  })
})

describe('Income add flow', () => {
  it('opens the add sheet when Add income is clicked', async () => {
    const user = userEvent.setup()
    renderIncome()
    await waitFor(() => screen.getAllByRole('button', { name: /add income/i }))
    const addBtns = screen.getAllByRole('button', { name: /add income/i })
    await user.click(addBtns[addBtns.length - 1])
    // Sheet title is "Add income" — verify the sheet is present
    const headings = screen.getAllByText('Add income')
    expect(headings.length).toBeGreaterThan(1)
  })

  it('rejects empty label submission', async () => {
    const user = userEvent.setup()
    renderIncome()
    await waitFor(() => screen.getAllByRole('button', { name: /add income/i }))
    const addBtns = screen.getAllByRole('button', { name: /add income/i })
    await user.click(addBtns[addBtns.length - 1])
    // Sheet is open; submit buttons now exist — all disabled when label is empty
    const submitBtns = screen.getAllByRole('button', { name: 'Add income' })
    // The sheet footer button is the last one
    expect(submitBtns[submitBtns.length - 1]).toBeDisabled()
  })

  it('calls createIncome and refetches on successful submit', async () => {
    const user = userEvent.setup()
    renderIncome()
    await waitFor(() => screen.getAllByRole('button', { name: /add income/i }))
    const addBtns = screen.getAllByRole('button', { name: /add income/i })
    await user.click(addBtns[addBtns.length - 1])

    // Fill form
    await user.type(screen.getByPlaceholderText(/freelance/i), 'Side project')
    const amtInput = screen.getByRole('spinbutton')
    await user.clear(amtInput)
    await user.type(amtInput, '200')

    // Submit via the sheet footer button (last in DOM)
    const submitBtns = screen.getAllByRole('button', { name: 'Add income' })
    await user.click(submitBtns[submitBtns.length - 1])

    await waitFor(() => {
      expect(createIncome).toHaveBeenCalledWith(1, expect.objectContaining({ label: 'Side project', amount: 200 }))
      expect(mockRefetch).toHaveBeenCalled()
    })
  })
})

describe('Income validation', () => {
  it('disables submit when amount is negative', async () => {
    const user = userEvent.setup()
    renderIncome()
    await waitFor(() => screen.getAllByRole('button', { name: /add income/i }))
    const addBtns = screen.getAllByRole('button', { name: /add income/i })
    await user.click(addBtns[addBtns.length - 1])

    await user.type(screen.getByPlaceholderText(/freelance/i), 'Test')
    const amtInput = screen.getByRole('spinbutton')
    await user.clear(amtInput)
    await user.type(amtInput, '-50')

    const submitBtns = screen.getAllByRole('button', { name: 'Add income' })
    expect(submitBtns[submitBtns.length - 1]).toBeDisabled()
  })
})

describe('Income write failures', () => {
  async function openAddSheet() {
    const user = userEvent.setup()
    renderIncome()
    await waitFor(() => screen.getAllByRole('button', { name: /add income/i }))
    const addBtns = screen.getAllByRole('button', { name: /add income/i })
    await user.click(addBtns[addBtns.length - 1])
    await user.type(screen.getByPlaceholderText(/freelance/i), 'Side project')
    const amtInput = screen.getByRole('spinbutton')
    await user.clear(amtInput)
    await user.type(amtInput, '200')
    return user
  }

  it('surfaces the error and refetches true state when a create fails', async () => {
    vi.mocked(createIncome).mockRejectedValue(new Error('Failed to save'))
    const user = await openAddSheet()

    const submitBtns = screen.getAllByRole('button', { name: 'Add income' })
    await user.click(submitBtns[submitBtns.length - 1])

    await waitFor(() => expect(screen.getByText('Failed to save')).toBeTruthy())
    // No optimistic value is left behind — the screen is re-synced with the API.
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('shows the read-only message when the backend rejects a stale editable month', async () => {
    // The browser thought this month was editable but the Pi disagrees at the
    // month boundary — the backend is authoritative.
    vi.mocked(createIncome).mockRejectedValue(
      new Error('This month is read-only — only the current month can be edited'),
    )
    const user = await openAddSheet()

    const submitBtns = screen.getAllByRole('button', { name: 'Add income' })
    await user.click(submitBtns[submitBtns.length - 1])

    await waitFor(() => expect(screen.getByText(/read-only/i)).toBeTruthy())
    expect(mockRefetch).toHaveBeenCalled()
  })
})
