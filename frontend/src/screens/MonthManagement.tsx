import { useState, useEffect } from 'react'
import { carryForwardPreview, createMonth, monthSummary } from '../api/months'
import type { MonthRead, BudgetSummary, CarryForwardItem } from '../api/types'
import { NavHeader } from '../components/NavHeader'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { StateView } from '../components/StateView'
import { Icon } from '../components/Icon'
import { Money } from '../components/Money'
import { MoneyInput } from '../components/MoneyInput'
import { SectionLabel } from '../components/SectionLabel'
import { Banner } from '../components/Banner'
import type { ScreenName } from '../App'
import type { CarryRow } from '../lib/projected'
import { calcProjectedSurplus } from '../lib/projected'
import styles from './MonthManagement.module.css'

interface MonthManagementScreenProps {
  screen: ScreenName
  months: MonthRead[]
  editableMonthId: number | null
  activeMonthId: number
  onSwitchMonth: (id: number) => void
  onBack: () => void
  onMonthCreated: (id: number) => void
  onGoCreateMonth: () => void
}

function nextMonthStr(months: MonthRead[]): string {
  if (months.length === 0) {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
  const latest = months.reduce((max, m) => (m.month > max.month ? m : max))
  const [y, m] = latest.month.split('-').map(Number) as [number, number]
  const next = new Date(y, m)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

function nextMonthLabel(months: MonthRead[]): string {
  const s = nextMonthStr(months)
  if (!s) return ''
  const [y, m] = s.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

function MonthsList({
  months,
  editableMonthId,
  activeMonthId,
  onSwitch,
  onCreateMonth,
  onBack,
}: {
  months: MonthRead[]
  editableMonthId: number | null
  activeMonthId: number
  onSwitch: (id: number) => void
  onCreateMonth: () => void
  onBack: () => void
}) {
  const [summaries, setSummaries] = useState<Record<number, BudgetSummary>>({})

  useEffect(() => {
    months.forEach(m => {
      monthSummary(m.id).then(s => {
        setSummaries(prev => ({ ...prev, [m.id]: s }))
      }).catch(() => {/* ignore individual summary failures */})
    })
  }, [months])

  return (
    <div className={styles.root}>
      <NavHeader title="Months" onBack={onBack} backLabel="Dashboard" />
      <div className={styles.scroll}>
        <div className={styles.content}>
          <Button variant="primary" full icon="plus" onClick={onCreateMonth}>
            Create new month
          </Button>
          <div style={{ height: 18 }} />
          {[...months].reverse().map(m => {
            const isCurrent = m.id === editableMonthId
            const isActive = m.id === activeMonthId
            const [y, mo] = m.month.split('-')
            const label = new Date(Number(y), Number(mo) - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
            const summary = summaries[m.id]
            return (
              <Card
                key={m.id}
                pad={16}
                onClick={() => onSwitch(m.id)}
                className={`${styles.monthCard} ${isActive ? styles.monthCardActive : ''}`}
              >
                <div className={styles.monthCardHeader}>
                  <div className={styles.monthCardTitleRow}>
                    <span className={styles.monthLabel}>{label}</span>
                    {isCurrent
                      ? <span className={styles.currentBadge}>Current</span>
                      : <Icon name="lock" size={14} style={{ color: 'var(--ink-3)' }} />
                    }
                  </div>
                  <Icon name="chevR" size={18} style={{ color: 'var(--ink-3)' }} />
                </div>
                {summary && (
                  <div className={styles.monthFigs}>
                    <div>
                      <div className={styles.miniLabel}>Income</div>
                      <Money value={summary.total_income} size="16px" weight={700} />
                    </div>
                    <div>
                      <div className={styles.miniLabel}>Surplus</div>
                      <Money value={summary.monthly_surplus} size="16px" weight={700} />
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CreateMonthFlow({
  months,
  onBack,
  onCreated,
}: {
  months: MonthRead[]
  onBack: () => void
  onCreated: (id: number) => void
}) {
  const newMonthStr = nextMonthStr(months)
  const newLabel = nextMonthLabel(months)
  const [rows, setRows] = useState<CarryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    carryForwardPreview(newMonthStr)
      .then(p => {
        const incomeRows: CarryRow[] = p.income.map((it: CarryForwardItem) => ({
          source_type: 'income',
          source_id: it.source_id,
          label: it.label,
          amount: it.amount,
          excluded: false,
        }))
        const billRows: CarryRow[] = p.bills.map((it: CarryForwardItem) => ({
          source_type: 'bill',
          source_id: it.source_id,
          label: it.label,
          amount: it.amount,
          category: it.category ?? undefined,
          excluded: false,
        }))
        setRows([...incomeRows, ...billRows])
        setLoading(false)
      })
      .catch(e => {
        setPreviewError(e instanceof Error ? e.message : 'Failed to load preview')
        setLoading(false)
      })
  }, [newMonthStr])

  const projected = calcProjectedSurplus(rows)

  const toggleExclude = (idx: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, excluded: !r.excluded } : r))
  }

  const updateAmount = (idx: number, val: string) => {
    const n = parseFloat(val)
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, amount: isNaN(n) ? r.amount : n } : r))
  }

  const handleConfirm = async (skipCarry: boolean) => {
    setSaving(true)
    setSaveError(null)
    try {
      const result = await createMonth({
        month: newMonthStr,
        carry_forward: !skipCarry,
        overrides: skipCarry ? [] : rows
          .filter(r => !r.excluded)
          .map(r => ({
            source_type: r.source_type,
            source_id: r.source_id,
            amount: r.amount,
          })),
      })
      onCreated(result.id)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to create month')
      setSaving(false)
    }
  }

  if (loading) return <StateView loading />

  const incomeRows = rows.filter(r => r.source_type === 'income')
  const billRows = rows.filter(r => r.source_type === 'bill')

  return (
    <div className={styles.root}>
      <NavHeader title="New month" onBack={onBack} backLabel="Months" />
      <div className={styles.scroll}>
        {previewError && <Banner tone="red" icon="x">{previewError}</Banner>}
        {saveError && <Banner tone="red" icon="x">{saveError}</Banner>}
        <div className={styles.createContent}>
          <Card pad={16} className={styles.infoCard}>
            <div className={styles.infoCardTitle}>Carry forward to {newLabel}</div>
            <div className={styles.infoCardDesc}>
              These recurring items came from your last month. Untick anything to skip, or amend the amounts before confirming.
            </div>
          </Card>

          {[{ title: 'Income', rows: incomeRows }, { title: 'Fixed bills', rows: billRows }].map(({ title, rows: groupRows }) => {
            if (groupRows.length === 0) return null
            const idxOffset = title === 'Income' ? 0 : incomeRows.length
            return (
              <div key={title} style={{ marginBottom: 16 }}>
                <SectionLabel>{title}</SectionLabel>
                <Card pad="2px 16px">
                  {groupRows.map((row, localIdx) => {
                    const globalIdx = idxOffset + localIdx
                    return (
                      <div
                        key={row.source_id}
                        className={`${styles.carryRow} ${row.excluded ? styles.carryRowExcluded : ''}`}
                      >
                        <button
                          type="button"
                          className={`${styles.checkBtn} ${row.excluded ? styles.checkBtnOff : styles.checkBtnOn}`}
                          onClick={() => toggleExclude(globalIdx)}
                        >
                          {!row.excluded && <Icon name="check" size={15} />}
                        </button>
                        <span className={styles.carryLabel}>{row.label}</span>
                        <div className={styles.carryAmtWrapper}>
                          <MoneyInput
                            value={String(row.amount)}
                            onChange={val => updateAmount(globalIdx, val)}
                          />
                        </div>
                      </div>
                    )
                  })}
                </Card>
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.projectedRow}>
          <span className={styles.projectedLabel}>Projected surplus</span>
          <Money value={projected} size="16px" weight={700} />
        </div>
        <Button
          variant="primary"
          full
          disabled={saving}
          onClick={() => handleConfirm(false)}
        >
          Create {newLabel}
        </Button>
      </div>
    </div>
  )
}

export function MonthManagementScreen({
  screen,
  months,
  editableMonthId,
  activeMonthId,
  onSwitchMonth,
  onBack,
  onMonthCreated,
  onGoCreateMonth,
}: MonthManagementScreenProps) {
  if (screen === 'create-month') {
    return (
      <CreateMonthFlow
        months={months}
        onBack={onBack}
        onCreated={onMonthCreated}
      />
    )
  }
  return (
    <MonthsList
      months={months}
      editableMonthId={editableMonthId}
      activeMonthId={activeMonthId}
      onSwitch={onSwitchMonth}
      onCreateMonth={onGoCreateMonth}
      onBack={onBack}
    />
  )
}
