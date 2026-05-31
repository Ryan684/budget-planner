import styles from './MoneyInput.module.css'

interface MoneyInputProps {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

export function MoneyInput({ value, onChange, autoFocus }: MoneyInputProps) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.prefix}>£</span>
      <input
        className={styles.input}
        type="number"
        inputMode="decimal"
        value={value}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        min="0"
        step="0.01"
      />
    </div>
  )
}
