import { Icon } from '../components/Icon'
import { Button } from '../components/Button'
import styles from './EmptyState.module.css'

interface EmptyStateScreenProps {
  onCreateMonth: () => void
}

export function EmptyStateScreen({ onCreateMonth }: EmptyStateScreenProps) {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Budget</h1>
      </div>
      <div className={styles.body}>
        <div className={styles.iconBox}>
          <Icon name="calendar" size={36} />
        </div>
        <h2 className={styles.heading}>No budget yet</h2>
        <p className={styles.desc}>
          Start by creating your first month. Add your income and fixed bills to see your monthly surplus.
        </p>
        <Button variant="primary" icon="plus" onClick={onCreateMonth}>
          Create your first month
        </Button>
      </div>
    </div>
  )
}
