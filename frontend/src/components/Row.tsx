import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { Money } from './Money'
import styles from './Row.module.css'

interface RowProps {
  label: string
  sub?: string
  amount?: number
  recurring?: boolean
  dot?: string
  onClick?: () => void
  right?: ReactNode
  last?: boolean
  noBorder?: boolean
}

export function Row({
  label,
  sub,
  amount,
  recurring,
  dot,
  onClick,
  right,
  last,
  noBorder,
}: RowProps) {
  const cls = [
    styles.row,
    (last || noBorder) ? styles.noBorder : '',
    onClick ? styles.interactive + ' bp-press' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls} onClick={onClick}>
      {dot && (
        <span className={styles.dot} style={{ background: dot }} />
      )}
      <div className={styles.body}>
        <div className={styles.labelRow}>
          <span className={styles.label}>{label}</span>
          {recurring && <Icon name="recurring" size={13} className={styles.chevron} />}
        </div>
        {sub && <div className={styles.sub}>{sub}</div>}
      </div>
      {right}
      {amount !== undefined && <Money value={amount} size="15px" weight={600} />}
      {onClick && <Icon name="chevR" size={16} className={styles.chevron} />}
    </div>
  )
}
