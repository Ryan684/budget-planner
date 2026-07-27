import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, ApiError, REQUEST_TIMEOUT_MS } from '../client'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('apiFetch when the backend is unreachable', () => {
  it('gives up within the request timeout instead of hanging', async () => {
    // A dead Pi accepts the connection and never answers.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')))
          }),
      ),
    )

    const pending = apiFetch('/months')
    const assertion = expect(pending).rejects.toBeInstanceOf(ApiError)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

    await assertion
  })

  it('reports a retryable, non-technical message on timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')))
          }),
      ),
    )

    const pending = apiFetch('/months').catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
    const error = (await pending) as ApiError

    expect(error.message).toMatch(/could not reach/i)
    expect(error.status).toBe(0)
  })

  it('surfaces an outright network failure as a retryable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const error = (await apiFetch('/months').catch((e: unknown) => e)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.message).toMatch(/could not reach/i)
  })

  it('clears the timeout once a response arrives', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ id: 1 }]),
      }),
    )

    await expect(apiFetch('/months')).resolves.toEqual([{ id: 1 }])
    expect(vi.getTimerCount()).toBe(0)
  })
})
