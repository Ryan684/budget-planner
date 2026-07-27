import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClaudeScreen } from '../Claude'

vi.mock('../../api/claude', () => ({
  postClaudeMessage: vi.fn(),
  undoLastClaudeChange: vi.fn(),
}))

import { postClaudeMessage, undoLastClaudeChange } from '../../api/claude'

const summary = {
  month_id: 1,
  month: '2026-06',
  total_income: 3200,
  total_bills: 1185,
  monthly_surplus: 2015,
  total_balances: 8400,
  total_savings: 8400,
}

beforeEach(() => {
  vi.clearAllMocks()
})

async function ask(text: string) {
  const user = userEvent.setup()
  render(<ClaudeScreen />)
  await user.type(screen.getByLabelText('Message Claude'), text)
  await user.click(screen.getByRole('button', { name: 'Send' }))
  return user
}

describe('Claude querying', () => {
  it('shows the empty hint and no undo control at session start', () => {
    render(<ClaudeScreen />)
    expect(screen.getByText(/ask about your budget/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /undo last claude change/i })).toBeNull()
  })

  it('shows the user message and the grounded reply', async () => {
    vi.mocked(postClaudeMessage).mockResolvedValue({
      reply: 'Your surplus this month is £2,015.00.',
      writes: [],
      summary,
    })
    await ask("what's our surplus?")
    await waitFor(() => {
      expect(screen.getByText("what's our surplus?")).toBeTruthy()
      expect(screen.getByText('Your surplus this month is £2,015.00.')).toBeTruthy()
    })
  })

  it('sends the prior conversation as context on a follow-up', async () => {
    vi.mocked(postClaudeMessage)
      .mockResolvedValueOnce({ reply: 'A1', writes: [], summary })
      .mockResolvedValueOnce({ reply: 'A2', writes: [], summary })
    const user = await ask('first')
    await waitFor(() => expect(screen.getByText('A1')).toBeTruthy())
    await user.type(screen.getByLabelText('Message Claude'), 'second')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() =>
      expect(vi.mocked(postClaudeMessage).mock.calls[1]).toEqual([
        'second',
        [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'A1' },
        ],
      ]),
    )
  })

  it('shows a friendly error when the assistant is unavailable', async () => {
    vi.mocked(postClaudeMessage).mockRejectedValue(new Error('The assistant is unavailable'))
    await ask('hello')
    await waitFor(() => expect(screen.getByText(/unavailable/i)).toBeTruthy())
  })
})

describe('Claude writing', () => {
  it('shows the write confirmation and reveals the undo control', async () => {
    vi.mocked(postClaudeMessage).mockResolvedValue({
      reply: "I'll add a £45.00 water bill; surplus falls to £1,970.00. Done.",
      writes: [
        {
          amendment_id: 7,
          entity_type: 'bill',
          entity_id: 12,
          entity_label: 'Water',
          field_changed: 'created',
          old_value: null,
          new_value: 'Water (£45.00)',
          reason: 'add water',
        },
      ],
      summary: { ...summary, total_bills: 1230, monthly_surplus: 1970 },
    })
    await ask('add a £45 water bill')
    await waitFor(() => {
      expect(screen.getByText(/I'll add a £45.00 water bill/)).toBeTruthy()
      expect(screen.getByRole('button', { name: /undo last claude change/i })).toBeTruthy()
    })
  })
})

describe('Claude undo', () => {
  it('reverts the last change and hides the control', async () => {
    vi.mocked(postClaudeMessage).mockResolvedValue({
      reply: 'Added the water bill.',
      writes: [
        {
          amendment_id: 7,
          entity_type: 'bill',
          entity_id: 12,
          entity_label: 'Water',
          field_changed: 'created',
          old_value: null,
          new_value: 'Water (£45.00)',
          reason: 'add water',
        },
      ],
      summary,
    })
    vi.mocked(undoLastClaudeChange).mockResolvedValue({ reverted: [7], summary })

    const user = await ask('add a £45 water bill')
    const undoBtn = await screen.findByRole('button', { name: /undo last claude change/i })
    await user.click(undoBtn)

    await waitFor(() => {
      expect(undoLastClaudeChange).toHaveBeenCalledWith([7])
      expect(screen.queryByRole('button', { name: /undo last claude change/i })).toBeNull()
    })
  })
})

describe('Claude API failure', () => {
  it('shows a friendly error and preserves the conversation and typed message', async () => {
    vi.mocked(postClaudeMessage)
      .mockResolvedValueOnce({ reply: 'Your surplus is £2,015.00.', writes: [], summary })
      .mockRejectedValueOnce(new Error('The assistant is unavailable right now. Please try again.'))
    const user = await ask("what's our surplus?")
    await waitFor(() => expect(screen.getByText('Your surplus is £2,015.00.')).toBeTruthy())

    await user.type(screen.getByLabelText('Message Claude'), 'add a £45 water bill')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() =>
      expect(screen.getByText(/assistant is unavailable/i)).toBeTruthy(),
    )
    // The earlier turn survives...
    expect(screen.getByText('Your surplus is £2,015.00.')).toBeTruthy()
    expect(screen.getByText("what's our surplus?")).toBeTruthy()
    // ...and the failed message is still in the box, ready to resend.
    expect(screen.getByLabelText('Message Claude')).toHaveValue('add a £45 water bill')
  })

  it('lets the user resend after a failure without retyping', async () => {
    vi.mocked(postClaudeMessage)
      .mockRejectedValueOnce(new Error('The assistant is unavailable right now. Please try again.'))
      .mockResolvedValueOnce({ reply: 'Added the water bill.', writes: [], summary })
    const user = await ask('add a £45 water bill')
    await waitFor(() => expect(screen.getByText(/assistant is unavailable/i)).toBeTruthy())

    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(screen.getByText('Added the water bill.')).toBeTruthy())
    expect(screen.getByLabelText('Message Claude')).toHaveValue('')
  })
})
