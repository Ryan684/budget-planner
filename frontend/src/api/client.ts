const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

/**
 * How long to wait for the Pi before giving up. A backend that is off accepts
 * nothing and `fetch` rejects immediately, but one that is unreachable mid-route
 * can hang indefinitely — the timeout turns that into a retryable error state
 * rather than an endless spinner (SC-004).
 */
export const REQUEST_TIMEOUT_MS = 10_000

const UNREACHABLE = 'Could not reach the app. Check the connection and try again.'

export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

type ValidationError = { loc: string[]; msg: string; type: string }

function extractMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const first = detail[0] as ValidationError | undefined
    if (first?.msg) return first.msg
  }
  return 'An unexpected error occurred'
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${BASE}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    // `init` is spread first so the merged headers and the timeout signal win —
    // spreading it last would let a caller's `headers` replace the content type
    // wholesale and drop the abort signal.
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      signal: controller.signal,
    })
  } catch {
    // A timeout, a refused connection, or a dropped network all read the same
    // to the user: the app cannot be reached, and retrying is the way forward.
    throw new ApiError(0, UNREACHABLE)
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 204) return undefined as T

  const body: unknown = await res.json()

  if (!res.ok) {
    const detail = (body as { detail?: unknown })?.detail ?? body
    const message =
      res.status === 409
        ? 'That month already exists'
        : res.status === 404
          ? 'Not found'
          : extractMessage(detail)
    throw new ApiError(res.status, message, detail)
  }

  return body as T
}
