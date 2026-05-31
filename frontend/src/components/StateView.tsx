import type { ReactNode } from 'react'
import { Button } from './Button'
import styles from './StateView.module.css'

interface StateViewProps {
  loading?: boolean
  error?: string | null
  empty?: boolean
  emptyMessage?: string
  onRetry?: () => void
  children?: ReactNode
}

export function StateView({
  loading,
  error,
  empty,
  emptyMessage = 'Nothing here yet.',
  onRetry,
  children,
}: StateViewProps) {
  if (loading) {
    return (
      <div className={styles.root} role="status" aria-label="Loading">
        <div className={styles.spinner} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.root}>
        <p className={styles.errorMsg}>{error}</p>
        {onRetry && (
          <Button variant="ghost" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    )
  }

  if (empty) {
    return (
      <div className={styles.root}>
        <p className={styles.message}>{emptyMessage}</p>
        {children}
      </div>
    )
  }

  return null
}
