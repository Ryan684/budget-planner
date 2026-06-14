import { Icon } from './Icon'
import styles from './TabBar.module.css'

export type TabKey = 'dashboard' | 'bills' | 'accounts' | 'claude'

interface Tab {
  key: TabKey
  label: string
  icon: string
}

const TABS: Tab[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'bills',     label: 'Bills',     icon: 'bills' },
  { key: 'accounts',  label: 'Accounts',  icon: 'wallet' },
  { key: 'claude',    label: 'Claude',    icon: 'claude' },
]

interface TabBarProps {
  active: TabKey
  onChange: (key: TabKey) => void
  badge?: boolean
}

export function TabBar({ active, onChange, badge }: TabBarProps) {
  return (
    <div className={styles.bar}>
      {TABS.map(t => {
        const on = active === t.key
        return (
          <button
            key={t.key}
            type="button"
            className={`${styles.tab} ${on ? styles.tabActive : ''}`}
            onClick={() => onChange(t.key)}
          >
            <span className={styles.iconWrapper}>
              <Icon name={t.icon} size={24} sw={on ? 2 : 1.7} />
              {t.key === 'claude' && badge && <span className={styles.badge} />}
            </span>
            <span className={`${styles.label} ${on ? styles.labelActive : ''}`}>
              {t.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
