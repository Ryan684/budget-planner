import type { ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps {
  children: ReactNode
  pad?: number | string
  onClick?: () => void
  className?: string
}

export function Card({ children, pad = 16, onClick, className }: CardProps) {
  const cls = [
    styles.card,
    onClick ? styles.interactive + ' bp-press' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls} style={{ padding: pad }} onClick={onClick}>
      {children}
    </div>
  )
}
