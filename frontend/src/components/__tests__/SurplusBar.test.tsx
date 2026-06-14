import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SurplusBar } from '../SurplusBar'

function getSegments(container: HTMLElement) {
  const track = container.firstChild as HTMLElement
  return Array.from(track.children) as HTMLElement[]
}

describe('SurplusBar component', () => {
  it('renders a track element', () => {
    const { container } = render(<SurplusBar totalIncome={3000} totalBills={1200} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('shows bills segment proportional to income', () => {
    const { container } = render(<SurplusBar totalIncome={2000} totalBills={1000} />)
    const segments = getSegments(container)
    expect(segments[0].style.width).toBe('50%')
  })

  it('shows surplus segment for remainder', () => {
    const { container } = render(<SurplusBar totalIncome={2000} totalBills={1000} />)
    const segments = getSegments(container)
    expect(segments[1].style.width).toBe('50%')
  })

  it('shows bills at 100% when over budget (denom is totalBills)', () => {
    const { container } = render(<SurplusBar totalIncome={1000} totalBills={2000} />)
    const segments = getSegments(container)
    expect(segments[0].style.width).toBe('100%')
  })

  it('hides surplus segment when over budget', () => {
    const { container } = render(<SurplusBar totalIncome={1000} totalBills={2000} />)
    const segments = getSegments(container)
    expect(segments.length).toBe(1)
  })

  it('applies custom height', () => {
    const { container } = render(<SurplusBar totalIncome={2000} totalBills={1000} height={20} />)
    const track = container.firstChild as HTMLElement
    expect(track.style.height).toBe('20px')
  })

  it('applies over-budget CSS class on bills segment when exceeded', () => {
    const { container } = render(<SurplusBar totalIncome={1000} totalBills={2000} />)
    const segments = getSegments(container)
    expect(segments[0].className).toMatch(/[Oo]ver/)
  })
})
