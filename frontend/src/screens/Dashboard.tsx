import type { ScreenName } from '../App'

interface DashboardScreenProps {
  activeMonthId: number
  editableMonthId: number
  readOnly: boolean
  go: (screen: ScreenName) => void
}

export function DashboardScreen(_props: DashboardScreenProps) {
  return <div>Dashboard — loading…</div>
}
