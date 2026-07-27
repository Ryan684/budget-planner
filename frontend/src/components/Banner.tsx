import type { ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Banner.module.css'

type BannerTone = 'amber' | 'red' | 'green'

interface BannerProps {
  tone?: BannerTone
  icon?: string
  children: ReactNode
}

export function Banner({ tone = 'amber', icon = 'lock', children }: BannerProps) {
  return (
    <div className={`${styles.banner} ${styles[tone]}`} role="status">
      <Icon name={icon} size={16} />
      <span>{children}</span>
    </div>
  )
}
