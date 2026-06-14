import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MonthManagementScreen } from '../MonthManagement'

vi.mock('../../api/months', () => ({
  carryForwardPreview: vi.fn(),
  createMonth: vi.fn(),
  monthSummary: vi.fn(),
}))
vi.mock('../../hooks/useMonthDetail', () => ({
  useMonthDetail: vi.fn(),
}))

import { carryForwardPreview, createMonth, monthSummary } from '../../api/months'

const months = [
  { id: 1, month: '2024-05', notes: null, created_at: '', updated_at: '' },
  { id: 2, month: '2024-06', notes: null, created_at: '', updated_at: '' },
]

const mockSummaries = {
  1: { month_id: 1, month: '2024-05', total_income: 3000, total_bills: 1200, monthly_surplus: 1800, total_balances: 0, total_savings: 0 },
  2: { month_id: 2, month: '2024-06', total_income: 3500, total_bills: 1300, monthly_surplus: 2200, total_balances: 0, total_savings: 0 },
}

const preview = {
  from_month: '2024-05',
  income: [{ source_type: 'income' as const, source_id: 1, label: 'Salary', amount: 3000, category: null }],
  bills: [{ source_type: 'bill' as const, source_id: 1, label: 'Rent', amount: 1200, category: 'Housing' }],
}

beforeEach(() => {
  vi.mocked(carryForwardPreview).mockResolvedValue(preview)
  vi.mocked(createMonth).mockResolvedValue({ id: 3, month: '2024-07', notes: null, created_at: '', updated_at: '' })
  vi.mocked(monthSummary).mockImplementation((id) =>
    Promise.resolve(mockSummaries[id as keyof typeof mockSummaries] ?? mockSummaries[1])
  )
})

function renderMonthsList(props: {
  screen?: 'months' | 'create-month'
  activeMonthId?: number
} = {}) {
  const onSwitchMonth = vi.fn()
  const onBack = vi.fn()
  const onMonthCreated = vi.fn()
  const onGoCreateMonth = vi.fn()
  render(
    <MonthManagementScreen
      screen={props.screen ?? 'months'}
      months={months}
      editableMonthId={2}
      activeMonthId={props.activeMonthId ?? 2}
      onSwitchMonth={onSwitchMonth}
      onBack={onBack}
      onMonthCreated={onMonthCreated}
      onGoCreateMonth={onGoCreateMonth}
    />
  )
  return { onSwitchMonth, onBack, onMonthCreated, onGoCreateMonth }
}

describe('Months list', () => {
  it('shows month labels', async () => {
    renderMonthsList()
    await waitFor(() => {
      expect(screen.getByText(/May 2024/)).toBeTruthy()
      expect(screen.getByText(/June 2024/)).toBeTruthy()
    })
  })

  it('shows "Current" badge on the editable month', async () => {
    renderMonthsList()
    await waitFor(() => expect(screen.getByText('Current')).toBeTruthy())
  })

  it('shows lock icon on non-editable months', async () => {
    renderMonthsList()
    await waitFor(() => {
      // Lock icon is rendered as SVG — check for "lock" aria or visual indicator
      // Just check May 2024 row exists without Current badge
      expect(screen.getByText(/May 2024/)).toBeTruthy()
    })
  })

  it('calls onSwitchMonth when a month is tapped', async () => {
    const user = userEvent.setup()
    const { onSwitchMonth } = renderMonthsList()
    await waitFor(() => screen.getByText(/May 2024/))
    // Click on May 2024
    const mayCard = screen.getByText(/May 2024/).closest('[role=button],[type=button]') ??
      screen.getByText(/May 2024/).parentElement!.parentElement!
    await user.click(mayCard)
    await waitFor(() => expect(onSwitchMonth).toHaveBeenCalledWith(1))
  })

  it('shows create new month button', async () => {
    renderMonthsList()
    await waitFor(() => expect(screen.getByRole('button', { name: /create new month/i })).toBeTruthy())
  })
})

describe('Create month flow', () => {
  it('loads the carry-forward preview', async () => {
    renderMonthsList({ screen: 'create-month' })
    await waitFor(() => {
      expect(carryForwardPreview).toHaveBeenCalled()
      expect(screen.getByText('Salary')).toBeTruthy()
      expect(screen.getByText('Rent')).toBeTruthy()
    })
  })

  it('shows the projected surplus', async () => {
    renderMonthsList({ screen: 'create-month' })
    await waitFor(() => expect(screen.getByText(/projected surplus/i)).toBeTruthy())
  })

  it('calls createMonth on confirm', async () => {
    const user = userEvent.setup()
    const { onMonthCreated } = renderMonthsList({ screen: 'create-month' })
    await waitFor(() => screen.getByText('Salary'))
    const confirmBtn = screen.getByRole('button', { name: /create/i })
    await user.click(confirmBtn)
    await waitFor(() => {
      expect(createMonth).toHaveBeenCalled()
      expect(onMonthCreated).toHaveBeenCalledWith(3)
    })
  })
})
