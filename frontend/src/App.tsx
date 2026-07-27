import { useState, useEffect } from 'react'
import { useMonths } from './hooks/useMonths'
import { TabBar } from './components/TabBar'
import type { TabKey } from './components/TabBar'
import { PinGate } from './components/PinGate'
import { StateView } from './components/StateView'
import styles from './App.module.css'

// Lazy screen imports — filled in as screens are built
import { DashboardScreen } from './screens/Dashboard'
import { BillsScreen } from './screens/Bills'
import { AccountsScreen } from './screens/Accounts'
import { ClaudeScreen } from './screens/Claude'
import { IncomeScreen } from './screens/Income'
import { AmendmentsScreen } from './screens/Amendments'
import { MonthManagementScreen } from './screens/MonthManagement'
import { EmptyStateScreen } from './screens/EmptyState'

export type ScreenName =
  | 'dashboard'
  | 'bills'
  | 'accounts'
  | 'claude'
  | 'income'
  | 'amendments'
  | 'months'
  | 'create-month'
  | 'empty'

const TAB_SCREENS: TabKey[] = ['dashboard', 'bills', 'accounts', 'claude']

function tabFor(screen: ScreenName): TabKey {
  if (TAB_SCREENS.includes(screen as TabKey)) return screen as TabKey
  return 'dashboard'
}

export default function App() {
  // The gate renders its children only once the session is unlocked, so no
  // budget data is even fetched while the app is locked (FR-001).
  return (
    <PinGate>
      <BudgetApp />
    </PinGate>
  )
}

function BudgetApp() {
  const { months, editableMonthId, loading, error, refetch: refetchMonths } = useMonths()
  const [activeMonthId, setActiveMonthId] = useState<number | null>(null)
  const [screen, setScreen] = useState<ScreenName>('dashboard')

  // Sync activeMonthId to editableMonthId on first load
  useEffect(() => {
    if (editableMonthId !== null && activeMonthId === null) {
      setActiveMonthId(editableMonthId)
    }
  }, [editableMonthId, activeMonthId])

  if (loading) return <StateView loading />
  if (error) return <StateView error={error} onRetry={refetchMonths} />
  if (months.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.screenArea}>
          {screen === 'create-month' ? (
            <MonthManagementScreen
              screen="create-month"
              months={[]}
              editableMonthId={0}
              activeMonthId={0}
              onSwitchMonth={() => {}}
              onBack={() => setScreen('dashboard')}
              onMonthCreated={(id) => {
                setActiveMonthId(id)
                refetchMonths()
                go('dashboard')
              }}
              onGoCreateMonth={() => {}}
            />
          ) : (
            <EmptyStateScreen onCreateMonth={() => setScreen('create-month')} />
          )}
        </div>
      </div>
    )
  }

  const resolvedActiveMonthId = activeMonthId ?? editableMonthId!
  const readOnly = resolvedActiveMonthId !== editableMonthId

  const go = (s: ScreenName) => setScreen(s)
  const switchMonth = (id: number) => {
    setActiveMonthId(id)
    setScreen('dashboard')
  }

  const hideTabBar = screen === 'create-month'

  return (
    <div className={styles.root}>
      <div className={styles.screenArea}>
        {screen === 'dashboard' && (
          <DashboardScreen
            activeMonthId={resolvedActiveMonthId}
            editableMonthId={editableMonthId!}
            readOnly={readOnly}
            go={go}
          />
        )}
        {screen === 'bills' && (
          <BillsScreen
            activeMonthId={resolvedActiveMonthId}
            readOnly={readOnly}
          />
        )}
        {screen === 'accounts' && (
          <AccountsScreen
            editableMonthId={editableMonthId!}
          />
        )}
        {screen === 'claude' && <ClaudeScreen />}
        {screen === 'income' && (
          <IncomeScreen
            activeMonthId={resolvedActiveMonthId}
            readOnly={readOnly}
            onBack={() => go('dashboard')}
          />
        )}
        {screen === 'amendments' && (
          <AmendmentsScreen
            activeMonthId={resolvedActiveMonthId}
            onBack={() => go('dashboard')}
          />
        )}
        {(screen === 'months' || screen === 'create-month') && (
          <MonthManagementScreen
            screen={screen}
            months={months}
            editableMonthId={editableMonthId!}
            activeMonthId={resolvedActiveMonthId}
            onSwitchMonth={switchMonth}
            onBack={() => go('dashboard')}
            onMonthCreated={(id) => {
              setActiveMonthId(id)
              refetchMonths()
              go('dashboard')
            }}
            onGoCreateMonth={() => go('create-month')}
          />
        )}
      </div>
      {!hideTabBar && (
        <TabBar
          active={tabFor(screen)}
          onChange={(key) => {
            if (key === 'bills' || key === 'accounts' || key === 'claude') {
              go(key)
            } else {
              go('dashboard')
            }
          }}
        />
      )}
    </div>
  )
}
