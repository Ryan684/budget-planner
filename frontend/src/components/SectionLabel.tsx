import type { ReactNode } from 'react'
import styles from './SectionLabel.module.css'

interface SectionLabelProps {
  children: ReactNode
  action?: ReactNode
}

export function SectionLabel({ children, action }: SectionLabelProps) {
  return (
    <div className={styles.root}>
      <span className={styles.label}>{children}</span>
      {action}
    </div>
  )
}
