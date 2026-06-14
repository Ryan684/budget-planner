import styles from './SurplusBar.module.css'

interface SurplusBarProps {
  totalIncome: number
  totalBills: number
  height?: number
  onDark?: boolean
}

export function SurplusBar({ totalIncome, totalBills, height = 12, onDark = false }: SurplusBarProps) {
  const over = totalBills > totalIncome
  const denom = over ? totalBills : Math.max(totalIncome, 1)
  const billsPct = Math.min(100, (totalBills / denom) * 100)
  const surplus = totalIncome - totalBills
  const surplusPct = over || surplus <= 0 ? 0 : (surplus / denom) * 100

  const billClass = over
    ? styles.billsOver
    : onDark
      ? styles.billsDark
      : styles.bills

  const surplusClass = onDark ? styles.surplusDark : styles.surplus

  return (
    <div
      className={styles.track}
      style={{
        height,
        background: onDark ? 'rgba(255,255,255,0.16)' : 'var(--line-2)',
      }}
    >
      <div className={billClass} style={{ width: `${billsPct}%` }} />
      {surplusPct > 0 && (
        <div className={surplusClass} style={{ width: `${surplusPct}%` }} />
      )}
    </div>
  )
}
