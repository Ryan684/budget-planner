interface IconProps {
  name: string
  size?: number
  sw?: number
  className?: string
}

const PATHS: Record<string, string> = {
  chevL:     'M15 18l-6-6 6-6',
  chevR:     'M9 18l6-6-6-6',
  chevUp:    'M18 15l-6-6-6 6',
  chevDown:  'M6 9l6 6 6-6',
  x:         'M18 6 6 18M6 6l12 12',
  plus:      'M12 5v14M5 12h14',
  check:     'M20 6 9 17l-5-5',
  lock:      'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4',
  recurring: 'M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3',
  dashboard: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  bills:     'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  wallet:    'M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5',
  claude:    'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6z',
  dots:      'M12 5h.01M12 12h.01M12 19h.01',
  edit:      'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:     'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6',
  calendar:  'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
}

export function Icon({ name, size = 20, sw = 1.8, className }: IconProps) {
  const d = PATHS[name]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {d && <path d={d} />}
    </svg>
  )
}
