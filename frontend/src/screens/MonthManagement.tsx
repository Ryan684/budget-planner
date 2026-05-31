import type { MonthRead } from '../api/types'
import type { ScreenName } from '../App'

interface MonthManagementScreenProps {
  screen: ScreenName
  months: MonthRead[]
  editableMonthId: number
  activeMonthId: number
  onSwitchMonth: (id: number) => void
  onBack: () => void
  onMonthCreated: (id: number) => void
  onGoCreateMonth: () => void
}

export function MonthManagementScreen(_props: MonthManagementScreenProps) {
  return <div>Month Management — loading…</div>
}
