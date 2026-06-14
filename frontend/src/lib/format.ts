const GBP_FORMAT = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function gbp(value: number): string {
  if (value < 0) {
    return `-£${GBP_FORMAT.format(-value)}`
  }
  return `£${GBP_FORMAT.format(value)}`
}

export function fmtTimestamp(isoUtc: string): string {
  return new Date(isoUtc).toLocaleString()
}
