import { gbp } from '../lib/format'
import styles from './Money.module.css'

interface MoneyProps {
  value: number
  weight?: number
  size?: string
  className?: string
}

export function Money({ value, weight = 600, size, className }: MoneyProps) {
  const cls = [
    styles.money,
    value < 0 ? styles.negative : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      className={cls}
      style={{ fontWeight: weight, fontSize: size }}
    >
      {gbp(value)}
    </span>
  )
}
