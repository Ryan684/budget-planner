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

describe('apiFetch request shape and response handling', () => {
  function stubOk(body: unknown, status = 200) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('calls the API base path with a JSON content type', async () => {
    const fetchMock = stubOk([{ id: 1 }])

    await apiFetch('/months')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/months',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('lets the caller override headers', async () => {
    const fetchMock = stubOk({})

    await apiFetch('/months', { method: 'POST', headers: { 'X-Test': 'yes' } })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-Test': 'yes' })
  })

  it('returns undefined for a 204 rather than parsing an empty body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('no body to parse')),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/income/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('throws the backend detail on a rejected write', async () => {
    stubOk({ detail: 'This month is read-only — only the current month can be edited' }, 403)

    const error = (await apiFetch('/income/1').catch((e: unknown) => e)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(403)
    expect(error.message).toMatch(/read-only/)
  })

  it('maps 404 and 409 to friendly messages', async () => {
    stubOk({ detail: 'BudgetMonth not found' }, 404)
    await expect(apiFetch('/months/9')).rejects.toThrow('Not found')

    stubOk({ detail: 'Month 2026-07 already exists' }, 409)
    await expect(apiFetch('/months')).rejects.toThrow('That month already exists')
  })

  it('surfaces the first validation message from a 422', async () => {
    stubOk({ detail: [{ loc: ['body', 'pin'], msg: 'Input should be a valid string', type: 'x' }] }, 422)

    await expect(apiFetch('/verify-pin')).rejects.toThrow('Input should be a valid string')
  })

  it('names the error class so callers can identify it', async () => {
    stubOk({ detail: 'nope' }, 500)

    const error = (await apiFetch('/months').catch((e: unknown) => e)) as ApiError

    expect(error.name).toBe('ApiError')
  })

  it('resolves the parsed body on success', async () => {
    stubOk({ id: 7, month: '2026-07' })

    await expect(apiFetch('/months/7')).resolves.toEqual({ id: 7, month: '2026-07' })
  })
})

describe('apiFetch error-detail extraction', () => {
  function stubStatus(body: unknown, status: number) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status, json: () => Promise.resolve(body) }),
    )
  }

  it('falls back to a generic message for an empty validation list', async () => {
    stubStatus({ detail: [] }, 422)

    await expect(apiFetch('/verify-pin')).rejects.toThrow('An unexpected error occurred')
  })

  it('falls back to a generic message when the detail has no message', async () => {
    stubStatus({ detail: [{ loc: ['body'], type: 'x' }] }, 422)

    await expect(apiFetch('/verify-pin')).rejects.toThrow('An unexpected error occurred')
  })

  it('falls back to a generic message for an unrecognised detail shape', async () => {
    stubStatus({ detail: { unexpected: true } }, 500)

    await expect(apiFetch('/months')).rejects.toThrow('An unexpected error occurred')
  })
})
