import styles from './Toggle.module.css'

interface ToggleProps {
  on: boolean
  onClick: () => void
  label?: string
}

export function Toggle({ on, onClick, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`${styles.toggle} ${on ? styles.on : styles.off}`}
      onClick={onClick}
    >
      <span className={styles.thumb} />
    </button>
  )
}
