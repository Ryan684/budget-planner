import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AmendmentsScreen } from '../Amendments'

vi.mock('../../hooks/useAmendments', () => ({
  useAmendments: vi.fn(),
}))

import { useAmendments } from '../../hooks/useAmendments'

const mockAmendments = [
  {
    id: 1,
    month_id: 2,
    entity_type: 'income' as const,
    entity_id: 1,
    entity_label: 'Ryan Salary',
    field_changed: 'created',
    old_value: null,
    new_value: 'Ryan Salary (£3,850.00)',
    reason: 'Initial entry',
    source: 'user' as const,
    amended_at: '2024-06-01T10:00:00Z',
  },
  {
    id: 2,
    month_id: 2,
    entity_type: 'bill' as const,
    entity_id: 3,
    entity_label: 'Electricity',
    field_changed: 'amount',
    old_value: '1200',
    new_value: '1300',
    reason: 'Rent increase',
    source: 'claude' as const,
    amended_at: '2024-06-02T14:30:00Z',
  },
]

beforeEach(() => {
  vi.mocked(useAmendments).mockReturnValue({
    data: mockAmendments,
    loading: false,
    error: null,
    refetch: vi.fn(),
  })
})

describe('Amendments screen', () => {
  it('shows loading state', () => {
    vi.mocked(useAmendments).mockReturnValue({
      data: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    })
    render(<AmendmentsScreen activeMonthId={2} onBack={vi.fn()} />)
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('shows error state with retry', () => {
    const refetch = vi.fn()
    vi.mocked(useAmendments).mockReturnValue({
      data: [],
      loading: false,
      error: 'Network error',
      refetch,
    })
    render(<AmendmentsScreen activeMonthId={2} onBack={vi.fn()} />)
    expect(screen.getByText(/network error/i)).toBeTruthy()
  })

  it('shows empty state when no amendments', () => {
    vi.mocked(useAmendments).mockReturnValue({
      data: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<AmendmentsScreen activeMonthId={2} onBack={vi.fn()} />)
    expect(screen.getByText(/no changes/i)).toBeTruthy()
  })

  it('shows "Created" verb for created amendments', async () => {
    render(<AmendmentsScreen activeMonthId={2} onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Created')).toBeTruthy())
  })

  it('shows "Updated amount" verb for field changes', async () => {
    render(<AmendmentsScreen activeMonthId={2} onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByText(/updated amount/i)).toBeTruthy())
  })

  it('shows source labels', async () => {
    render(<AmendmentsScreen activeMonthId={2} onBack={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('You')).toBeTruthy()
      expect(screen.getByText('Claude')).toBeTruthy()
    })
  })

  it('shows entity type labels', async () => {
    render(<AmendmentsScreen activeMonthId={2} onBack={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/income/i)).toBeTruthy()
      expect(screen.getByText(/bill/i)).toBeTruthy()
    })
  })

  it('shows reason text', async () => {
    render(<AmendmentsScreen activeMonthId={2} onBack={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('Rent increase')).toBeTruthy()
    })
  })

  it('shows entity label for field-update events', async () => {
    render(<AmendmentsScreen activeMonthId={2} onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Electricity')).toBeTruthy())
  })

  it('does not show entity label inline for lifecycle events', async () => {
    render(<AmendmentsScreen activeMonthId={2} onBack={vi.fn()} />)
    await waitFor(() => screen.getByText('Created'))
    // "Ryan Salary" appears only in the summary value, not as a separate label span
    // We check that exactly one instance appears (in the fromTo value, not duplicated)
    const matches = screen.getAllByText(/Ryan Salary/)
    expect(matches).toHaveLength(1)
  })

  it('shows lifecycle summary in the from/to area for created events', async () => {
    render(<AmendmentsScreen activeMonthId={2} onBack={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Ryan Salary (£3,850.00)')).toBeTruthy())
  })

  it('calls onBack when back button is pressed', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<AmendmentsScreen activeMonthId={2} onBack={onBack} />)
    await waitFor(() => screen.getByText('Created'))
    const backBtn = screen.getByRole('button', { name: /back|dashboard/i })
    await user.click(backBtn)
    expect(onBack).toHaveBeenCalled()
  })
})
