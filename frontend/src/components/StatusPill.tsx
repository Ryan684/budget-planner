import type { ReactNode } from 'react'
import styles from './StatusPill.module.css'

type PillTone = 'navy' | 'green' | 'amber' | 'red' | 'claude' | 'grey'

interface StatusPillProps {
  tone?: PillTone
  dot?: boolean
  children: ReactNode
}

export function StatusPill({ tone = 'navy', dot = true, children }: StatusPillProps) {
  return (
    <span className={`${styles.pill} ${styles[tone]}`}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  )
}
