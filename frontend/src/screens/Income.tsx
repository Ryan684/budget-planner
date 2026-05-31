interface IncomeScreenProps {
  activeMonthId: number
  readOnly: boolean
  onBack: () => void
}

export function IncomeScreen(_props: IncomeScreenProps) {
  return <div>Income — loading…</div>
}
