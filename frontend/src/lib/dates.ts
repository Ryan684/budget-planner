export function daysAgo(isoDate: string): number {
  const now = new Date()
  const then = new Date(isoDate)
  const diffMs = now.setHours(0, 0, 0, 0) - then.setHours(0, 0, 0, 0)
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export function isStale(isoDate: string): boolean {
  return daysAgo(isoDate) >= 30
}

export function nextMonthString(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number) as [number, number]
  const next = new Date(year, month) // month is 1-based, Date month is 0-based so this is correct
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

export function fmtAsOf(isoDate: string): string {
  const days = daysAgo(isoDate)
  if (days === 0) return 'Updated today'
  if (days === 1) return 'Updated yesterday'
  return `Updated ${days} days ago`
}

/**
 * The `YYYY-MM` key of the current calendar month in the browser's local time.
 * Mirrors the backend's `current_month.month_key` so the UI and the API agree on
 * which month is editable (the backend stays authoritative on a disagreement).
 */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
