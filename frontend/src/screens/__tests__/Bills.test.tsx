import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BillsScreen } from '../Bills'

vi.mock('../../hooks/useMonthDetail', () => ({
  useMonthDetail: vi.fn(),
}))
vi.mock('../../api/bills', () => ({
  createBill: vi.fn(),
  updateBill: vi.fn(),
  deleteBill: vi.fn(),
}))

import { useMonthDetail } from '../../hooks/useMonthDetail'
import { createBill } from '../../api/bills'

const mockRefetch = vi.fn()
const baseDetail = {
  data: {
    month: { id: 1, month: '2024-06', notes: null, created_at: '', updated_at: '' },
    income: [{ id: 1, month_id: 1, label: 'Salary', amount: 3000, is_recurring: true }],
    bills: [
      { id: 1, month_id: 1, label: 'Rent', amount: 1200, category: 'Housing', is_recurring: true, due_date: 1 },
      { id: 2, month_id: 1, label: 'Gas', amount: 80, category: 'Utilities', is_recurring: true, due_date: 15 },
      { id: 3, month_id: 1, label: 'Council Tax', amount: 150, category: 'Housing', is_recurring: true, due_date: null },
    ],
    summary: {
      month_id: 1, month: '2024-06',
      total_income: 3000, total_bills: 1430, monthly_surplus: 1570,
      total_balances: 0, total_savings: 0,
    },
  },
  loading: false,
  error: null,
  refetch: mockRefetch,
}

beforeEach(() => {
  vi.mocked(useMonthDetail).mockReturnValue(baseDetail)
  vi.mocked(createBill).mockResolvedValue({
    id: 4, month_id: 1, label: 'New', amount: 50, category: 'One-off', is_recurring: false, due_date: null,
  })
})

function renderBills(props: { readOnly?: boolean } = {}) {
  render(
    <BillsScreen
      activeMonthId={1}
      readOnly={props.readOnly ?? false}
    />
  )
}

describe('Bills list', () => {
  it('shows total bills', async () => {
    renderBills()
    await waitFor(() => expect(screen.getByText('Total bills')).toBeTruthy())
  })

  it('shows "Leaves as surplus"', async () => {
    renderBills()
    await waitFor(() => expect(screen.getByText('Leaves as surplus')).toBeTruthy())
  })

  it('groups bills by category', async () => {
    renderBills()
    await waitFor(() => {
      expect(screen.getByText('Housing')).toBeTruthy()
      expect(screen.getByText('Utilities')).toBeTruthy()
    })
  })

  it('shows bill labels within groups', async () => {
    renderBills()
    await waitFor(() => {
      expect(screen.getByText('Rent')).toBeTruthy()
      expect(screen.getByText('Gas')).toBeTruthy()
    })
  })

  it('shows due date label for bills with due_date', async () => {
    renderBills()
    await waitFor(() => expect(screen.getByText('Due 1st')).toBeTruthy())
  })
})

describe('Bills over-budget', () => {
  it('shows over-budget banner when bills exceed income', async () => {
    vi.mocked(useMonthDetail).mockReturnValue({
      ...baseDetail,
      data: {
        ...baseDetail.data,
        summary: {
          ...baseDetail.data.summary,
          total_income: 1000,
          total_bills: 1430,
          monthly_surplus: -430,
        },
      },
    })
    renderBills()
    await waitFor(() => expect(screen.getByText(/exceed income/i)).toBeTruthy())
  })
})

describe('Bills read-only', () => {
  it('hides add button in read-only mode', async () => {
    renderBills({ readOnly: true })
    await waitFor(() => expect(screen.queryByRole('button', { name: /add bill/i })).toBeNull())
  })

  it('shows read-only banner', async () => {
    renderBills({ readOnly: true })
    await waitFor(() => expect(screen.getByText(/read.only/i)).toBeTruthy())
  })
})

describe('Bills add flow', () => {
  it('opens the add sheet when Add bill is clicked', async () => {
    const user = userEvent.setup()
    renderBills()
    await waitFor(() => screen.getAllByRole('button', { name: /add bill/i }))
    const addBtns = screen.getAllByRole('button', { name: /add bill/i })
    await user.click(addBtns[addBtns.length - 1])
    expect(screen.getAllByText(/add bill/i).length).toBeGreaterThan(0)
  })

  it('calls createBill and refetches on successful submit', async () => {
    const user = userEvent.setup()
    renderBills()
    await waitFor(() => screen.getAllByRole('button', { name: /add bill/i }))
    const addBtns = screen.getAllByRole('button', { name: /add bill/i })
    await user.click(addBtns[addBtns.length - 1])

    await user.type(screen.getByPlaceholderText(/boiler/i), 'Broadband')
    const amtInput = screen.getByRole('spinbutton')
    await user.clear(amtInput)
    await user.type(amtInput, '30')

    const submitBtns = screen.getAllByRole('button', { name: 'Add bill' })
    await user.click(submitBtns[submitBtns.length - 1])

    await waitFor(() => {
      expect(createBill).toHaveBeenCalledWith(1, expect.objectContaining({ label: 'Broadband', amount: 30 }))
      expect(mockRefetch).toHaveBeenCalled()
    })
  })
})
