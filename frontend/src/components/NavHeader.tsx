import type { ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './NavHeader.module.css'

interface NavHeaderProps {
  title: string
  onBack?: () => void
  backLabel?: string
  right?: ReactNode
  children?: ReactNode
  compact?: boolean
}

export function NavHeader({ title, onBack, backLabel, right, children, compact }: NavHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.topRow}>
        {onBack ? (
          <button className={styles.backBtn} onClick={onBack} type="button">
            <Icon name="chevL" size={22} />
            {backLabel ?? ''}
          </button>
        ) : (
          <span />
        )}
        <div className={styles.spacer} />
        {right}
      </div>
      <div className={`${styles.titleRow} ${compact ? styles.titleRowCompact : ''}`}>
        <h1 className={styles.title}>{title}</h1>
      </div>
      {children}
    </div>
  )
}
