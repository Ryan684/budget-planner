import { useState } from 'react'
import { useMonthDetail } from '../hooks/useMonthDetail'
import { createIncome, updateIncome, deleteIncome } from '../api/income'
import type { IncomeRead } from '../api/types'
import { NavHeader } from '../components/NavHeader'
import { Card } from '../components/Card'
import { Row } from '../components/Row'
import { Banner } from '../components/Banner'
import { Button } from '../components/Button'
import { StateView } from '../components/StateView'
import { ItemSheet } from '../components/ItemSheet'
import { Money } from '../components/Money'
import { Icon } from '../components/Icon'
import styles from './Income.module.css'

interface IncomeScreenProps {
  activeMonthId: number
  readOnly: boolean
  onBack: () => void
}

export function IncomeScreen({ activeMonthId, readOnly, onBack }: IncomeScreenProps) {
  const { data, loading, error, refetch } = useMonthDetail(activeMonthId)
  const [sheet, setSheet] = useState<IncomeRead | null | 'new'>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (loading) return <StateView loading />
  if (error) return <StateView error={error} onRetry={refetch} />
  if (!data) return <StateView loading />

  const d = data!
  const monthLabel = d.month.month
  const [y, m] = monthLabel.split('-')
  const displayMonth = new Date(Number(y), Number(m) - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  const openNew = () => setSheet('new')
  const openEdit = (item: IncomeRead) => { if (!readOnly) setSheet(item) }
  const closeSheet = () => { setSheet(null); setSaveError(null) }

  const handleSave = async (payload: Record<string, unknown>) => {
    setSaveError(null)
    try {
      if (sheet === 'new') {
        await createIncome(activeMonthId, {
          label: payload.label as string,
          amount: payload.amount as number,
          is_recurring: payload.is_recurring as boolean,
        })
      } else if (sheet) {
        await updateIncome((sheet as IncomeRead).id, {
          label: payload.label as string,
          amount: payload.amount as number,
          is_recurring: payload.is_recurring as boolean,
        })
      }
      closeSheet()
      refetch()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  const handleDelete = async () => {
    if (!sheet || sheet === 'new') return
    setSaveError(null)
    try {
      await deleteIncome((sheet as IncomeRead).id)
      closeSheet()
      refetch()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  return (
    <div className={styles.root}>
      <NavHeader
        title="Income"
        onBack={onBack}
        backLabel="Dashboard"
        right={
          !readOnly && (
            <button type="button" className={styles.addHeaderBtn} onClick={openNew} aria-label="Add income">
              <Icon name="plus" size={20} />
            </button>
          )
        }
      />

      <div className={styles.scroll}>
        {readOnly && (
          <Banner tone="amber" icon="lock">
            Viewing {displayMonth} — read-only
          </Banner>
        )}
        {saveError && <Banner tone="red" icon="x">{saveError}</Banner>}

        <div className={styles.content}>
          <Card pad={18}>
            <div className={styles.totalCard}>
              <span className={styles.totalLabel}>Total income</span>
              <Money value={d.summary.total_income} size="24px" weight={700} />
            </div>
          </Card>

          <Card pad="2px 16px">
            {d.income.map((it, i) => (
              <Row
                key={it.id}
                label={it.label}
                recurring={it.is_recurring}
                sub={it.is_recurring ? 'Recurring' : 'One-off this month'}
                amount={it.amount}
                onClick={readOnly ? undefined : () => openEdit(it)}
                last={i === d.income.length - 1}
              />
            ))}
            {d.income.length === 0 && (
              <StateView empty emptyMessage="No income entries yet." />
            )}
          </Card>

          {!readOnly && (
            <Button variant="secondary" full icon="plus" className={styles.addBtn} onClick={openNew}>
              Add income
            </Button>
          )}
        </div>
      </div>

      {sheet !== null && (
        <ItemSheet
          mode="income"
          item={sheet === 'new' ? null : sheet}
          onClose={closeSheet}
          onSave={handleSave}
          onDelete={sheet !== 'new' ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
