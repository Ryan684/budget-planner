import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useMonths } from '../useMonths'

vi.mock('../../api/months', () => ({
  listMonths: vi.fn(),
}))

import { listMonths } from '../../api/months'

const mockListMonths = vi.mocked(listMonths)

function month(id: number, m: string) {
  return {
    id,
    month: m,
    notes: null,
    created_at: `${m}-01T00:00:00Z`,
    updated_at: `${m}-01T00:00:00Z`,
  }
}

/** Fixed browser-local "now": June 2026. */
const NOW = new Date(2026, 5, 17, 12, 0, 0)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

async function loadMonths(months: ReturnType<typeof month>[]) {
  mockListMonths.mockResolvedValue(months)
  const { result } = renderHook(() => useMonths())
  await waitFor(() => expect(result.current.loading).toBe(false))
  return result
}

describe('useMonths', () => {
  it('makes the month matching the local calendar month editable', async () => {
    const result = await loadMonths([month(1, '2026-05'), month(2, '2026-06')])

    expect(result.current.editableMonthId).toBe(2)
  })

  it('does not treat the latest month as editable', async () => {
    // September is the latest month, but June is the calendar month.
    const result = await loadMonths([month(2, '2026-06'), month(3, '2026-09')])

    expect(result.current.editableMonthId).toBe(2)
  })

  it('marks earlier months read-only', async () => {
    const result = await loadMonths([month(1, '2026-05'), month(2, '2026-06')])

    expect(result.current.isReadOnly(1)).toBe(true)
    expect(result.current.isReadOnly(2)).toBe(false)
  })

  it('marks future-dated months read-only', async () => {
    const result = await loadMonths([month(2, '2026-06'), month(3, '2026-09')])

    expect(result.current.isReadOnly(3)).toBe(true)
  })

  it('has no editable month when the calendar month has not been created', async () => {
    const result = await loadMonths([month(1, '2026-05'), month(3, '2026-09')])

    expect(result.current.editableMonthId).toBeNull()
    expect(result.current.isReadOnly(1)).toBe(true)
    expect(result.current.isReadOnly(3)).toBe(true)
  })

  it('has no editable month when there are no months at all', async () => {
    const result = await loadMonths([])

    expect(result.current.editableMonthId).toBeNull()
  })

  it('exposes the newest month separately from the editable one', async () => {
    const result = await loadMonths([month(1, '2026-05'), month(3, '2026-09')])

    expect(result.current.latestMonthId).toBe(3)
  })
})

describe('useMonths loading and refetch', () => {
  it('starts in a loading state', () => {
    mockListMonths.mockResolvedValue([])
    const { result } = renderHook(() => useMonths())

    expect(result.current.loading).toBe(true)
  })

  it('picks the newest month regardless of the order returned', async () => {
    const result = await loadMonths([month(3, '2026-09'), month(1, '2026-05')])

    expect(result.current.latestMonthId).toBe(3)
  })

  it('reloads the months when refetch is called', async () => {
    const result = await loadMonths([month(1, '2026-05')])
    mockListMonths.mockResolvedValue([month(1, '2026-05'), month(2, '2026-06')])

    act(() => result.current.refetch())

    await waitFor(() => expect(result.current.editableMonthId).toBe(2))
    expect(mockListMonths).toHaveBeenCalledTimes(2)
  })

  it('surfaces a load failure as an error', async () => {
    mockListMonths.mockRejectedValue(new Error('Could not reach the app.'))
    const { result } = renderHook(() => useMonths())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toMatch(/could not reach/i)
  })
})
