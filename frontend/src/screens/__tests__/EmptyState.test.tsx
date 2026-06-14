import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyStateScreen } from '../EmptyState'

describe('EmptyState', () => {
  it('shows "No budget yet" heading', () => {
    render(<EmptyStateScreen onCreateMonth={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /no budget yet/i })).toBeTruthy()
  })

  it('shows the create-first-month CTA button', () => {
    render(<EmptyStateScreen onCreateMonth={vi.fn()} />)
    expect(screen.getByRole('button', { name: /create your first month/i })).toBeTruthy()
  })

  it('calls onCreateMonth when CTA is clicked', async () => {
    const user = userEvent.setup()
    const onCreateMonth = vi.fn()
    render(<EmptyStateScreen onCreateMonth={onCreateMonth} />)
    await user.click(screen.getByRole('button', { name: /create your first month/i }))
    expect(onCreateMonth).toHaveBeenCalledOnce()
  })

  it('does not show any figures', () => {
    render(<EmptyStateScreen onCreateMonth={vi.fn()} />)
    expect(screen.queryByText(/£/)).toBeNull()
  })
})
