import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Money } from '../Money'

describe('Money component', () => {
  it('formats a positive value with £ prefix', () => {
    render(<Money value={1234.56} />)
    expect(screen.getByText('£1,234.56')).toBeTruthy()
  })

  it('formats zero', () => {
    render(<Money value={0} />)
    expect(screen.getByText('£0.00')).toBeTruthy()
  })

  it('formats a negative value with -£ prefix', () => {
    render(<Money value={-500} />)
    expect(screen.getByText('-£500.00')).toBeTruthy()
  })

  it('applies negative CSS class for negative values', () => {
    const { container } = render(<Money value={-100} />)
    const span = container.querySelector('span')!
    expect(span.className).toMatch(/negative/)
  })

  it('does not apply negative class for positive values', () => {
    const { container } = render(<Money value={100} />)
    const span = container.querySelector('span')!
    expect(span.className).not.toMatch(/negative/)
  })

  it('applies custom font weight via style', () => {
    const { container } = render(<Money value={500} weight={700} />)
    const span = container.querySelector('span')!
    expect(span.style.fontWeight).toBe('700')
  })

  it('applies custom font size via style', () => {
    const { container } = render(<Money value={500} size="24px" />)
    const span = container.querySelector('span')!
    expect(span.style.fontSize).toBe('24px')
  })
})
