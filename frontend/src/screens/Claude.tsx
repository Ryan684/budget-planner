import styles from './Claude.module.css'

export function ClaudeScreen() {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Claude</h1>
      </div>
      <div className={styles.body}>
        <p className={styles.placeholder}>Coming in Phase 3</p>
      </div>
    </div>
  )
}
