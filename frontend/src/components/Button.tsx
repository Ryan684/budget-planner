import type { ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: ButtonVariant
  icon?: string
  full?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  icon,
  full,
  disabled,
  type = 'button',
  className,
}: ButtonProps) {
  const cls = [
    styles.btn,
    styles[variant],
    full ? styles.full : '',
    disabled ? styles.disabled : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={19} />}
      {children}
    </button>
  )
}
