import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardScreen } from '../Dashboard'

vi.mock('../../hooks/useMonthDetail', () => ({
  useMonthDetail: vi.fn(),
}))
vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: vi.fn(),
}))

import { useMonthDetail } from '../../hooks/useMonthDetail'
import { useAccounts } from '../../hooks/useAccounts'

const mockDetail = {
  data: {
    month: { id: 1, month: '2024-06', notes: null, created_at: '2024-06-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' },
    income: [
      { id: 1, month_id: 1, label: 'Salary', amount: 3000, is_recurring: true },
      { id: 2, month_id: 1, label: 'Freelance', amount: 500, is_recurring: false },
    ],
    bills: [
      { id: 1, month_id: 1, label: 'Rent', amount: 1200, category: 'Housing', is_recurring: true, due_date: 1 },
    ],
    summary: {
      month_id: 1, month: '2024-06',
      total_income: 3500, total_bills: 1200, monthly_surplus: 2300,
      total_balances: 15000, total_savings: 8000,
    },
  },
  loading: false,
  error: null,
  refetch: vi.fn(),
}

const mockAccounts = {
  data: {
    accounts: [
      { id: 1, label: 'Current', balance: 7000, account_type: 'current' as const, as_of_date: '2024-06-01', notes: null },
      { id: 2, label: 'Savings', balance: 8000, account_type: 'savings' as const, as_of_date: '2024-06-01', notes: null },
    ],
    total_balances: 15000,
    total_savings: 8000,
  },
  loading: false,
  error: null,
  refetch: vi.fn(),
}

function renderDashboard(props: { readOnly?: boolean; activeMonthId?: number } = {}) {
  const mockGo = vi.fn()
  render(
    <DashboardScreen
      activeMonthId={props.activeMonthId ?? 1}
      editableMonthId={1}
      readOnly={props.readOnly ?? false}
      go={mockGo}
    />
  )
  return { mockGo }
}

beforeEach(() => {
  vi.mocked(useMonthDetail).mockReturnValue(mockDetail)
  vi.mocked(useAccounts).mockReturnValue(mockAccounts)
})

describe('Dashboard hero', () => {
  it('shows the monthly surplus figure', async () => {
    renderDashboard()
    await waitFor(() => {
      // Surplus appears in hero + receipt — at least one match required
      expect(screen.getAllByText('£2,300.00').length).toBeGreaterThan(0)
    })
  })

  it('shows a status pill', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('On track')).toBeTruthy()
    })
  })

  it('shows the surplus bar', async () => {
    renderDashboard()
    await waitFor(() => {
      // SurplusBar renders; total bills and total income are in the hero
      expect(screen.getAllByText(/£1,200\.00/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/£3,500\.00/).length).toBeGreaterThan(0)
    })
  })
})

describe('Dashboard receipt card', () => {
  it('shows total income', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Total income')).toBeTruthy()
    })
  })

  it('shows total bills', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Fixed bills')).toBeTruthy()
    })
  })

  it('shows monthly surplus in the receipt card', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getAllByText('Monthly surplus').length).toBeGreaterThan(0)
    })
  })
})

describe('Dashboard accounts card', () => {
  it('shows accounts total', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('£15,000.00')).toBeTruthy()
    })
  })
})

describe('Dashboard manage list', () => {
  it('shows Income row', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Income')).toBeTruthy()
    })
  })

  it('navigates to income screen when Income row is tapped', async () => {
    const user = userEvent.setup()
    const { mockGo } = renderDashboard()
    await waitFor(() => screen.getByText('Income'))
    await user.click(screen.getByText('Income'))
    expect(mockGo).toHaveBeenCalledWith('income')
  })

  it('shows Amendments log row', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Amendments log')).toBeTruthy()
    })
  })

  it('shows Months row', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Months')).toBeTruthy()
    })
  })
})

describe('Dashboard read-only mode', () => {
  it('shows read-only banner when viewing a past month', async () => {
    vi.mocked(useMonthDetail).mockReturnValue(mockDetail)
    render(
      <DashboardScreen
        activeMonthId={1}
        editableMonthId={2}
        readOnly={true}
        go={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(screen.getByText(/read.only/i)).toBeTruthy()
    })
  })
})

describe('Dashboard negative surplus', () => {
  it('shows negative surplus in red (negative formatting)', async () => {
    vi.mocked(useMonthDetail).mockReturnValue({
      ...mockDetail,
      data: {
        ...mockDetail.data,
        summary: {
          ...mockDetail.data.summary,
          monthly_surplus: -200,
          total_bills: 3700,
        },
      },
    })
    renderDashboard()
    await waitFor(() => {
      expect(screen.getAllByText('-£200.00').length).toBeGreaterThan(0)
    })
  })
})
