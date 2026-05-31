const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
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
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

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
