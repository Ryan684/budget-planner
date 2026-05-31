import { useState } from 'react'
import { useMonthDetail } from '../hooks/useMonthDetail'
import { createBill, updateBill, deleteBill } from '../api/bills'
import type { BillRead } from '../api/types'
import { NavHeader } from '../components/NavHeader'
import { Card } from '../components/Card'
import { Row } from '../components/Row'
import { Banner } from '../components/Banner'
import { Button } from '../components/Button'
import { StateView } from '../components/StateView'
import { ItemSheet } from '../components/ItemSheet'
import { Money } from '../components/Money'
import { Icon } from '../components/Icon'
import { getDot, categoryOrder } from '../lib/categories'
import { gbp } from '../lib/format'
import styles from './Bills.module.css'

interface BillsScreenProps {
  activeMonthId: number
  readOnly: boolean
}

function dueLabel(d: number | null): string | undefined {
  if (!d) return undefined
  const sfx =
    d % 10 === 1 && d !== 11 ? 'st' :
    d % 10 === 2 && d !== 12 ? 'nd' :
    d % 10 === 3 && d !== 13 ? 'rd' : 'th'
  return `Due ${d}${sfx}`
}

interface CategoryGroup {
  category: string
  dot: string
  bills: BillRead[]
  subtotal: number
}

function groupBills(bills: BillRead[]): CategoryGroup[] {
  const map = new Map<string, BillRead[]>()
  for (const b of bills) {
    const arr = map.get(b.category) ?? []
    arr.push(b)
    map.set(b.category, arr)
  }
  return [...map.entries()]
    .map(([category, grpBills]) => ({
      category,
      dot: getDot(category),
      bills: grpBills.sort((a, b) => {
        if (a.due_date === null && b.due_date === null) return 0
        if (a.due_date === null) return 1
        if (b.due_date === null) return -1
        return a.due_date - b.due_date
      }),
      subtotal: grpBills.reduce((s, b) => s + b.amount, 0),
    }))
    .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category))
}

export function BillsScreen({ activeMonthId, readOnly }: BillsScreenProps) {
  const { data, loading, error, refetch } = useMonthDetail(activeMonthId)
  const [sheet, setSheet] = useState<BillRead | null | 'new'>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (loading) return <StateView loading />
  if (error) return <StateView error={error} onRetry={refetch} />

  const d = data!
  const { summary, bills } = d
  const over = summary.total_bills > summary.total_income

  const monthLabel = d.month.month
  const [y, m] = monthLabel.split('-')
  const displayMonth = new Date(Number(y), Number(m) - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  const groups = groupBills(bills)

  const openNew = () => setSheet('new')
  const openEdit = (item: BillRead) => { if (!readOnly) setSheet(item) }
  const closeSheet = () => { setSheet(null); setSaveError(null) }

  const handleSave = async (payload: Record<string, unknown>) => {
    setSaveError(null)
    try {
      if (sheet === 'new') {
        await createBill(activeMonthId, {
          label: payload.label as string,
          amount: payload.amount as number,
          category: payload.category as string,
          is_recurring: payload.is_recurring as boolean,
          due_date: payload.due_date as number | null,
        })
      } else if (sheet) {
        await updateBill((sheet as BillRead).id, {
          label: payload.label as string,
          amount: payload.amount as number,
          category: payload.category as string,
          is_recurring: payload.is_recurring as boolean,
          due_date: payload.due_date as number | null,
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
    try {
      await deleteBill((sheet as BillRead).id)
      closeSheet()
      refetch()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  return (
    <div className={styles.root}>
      <NavHeader
        title="Bills"
        right={
          !readOnly && (
            <button type="button" className={styles.addHeaderBtn} onClick={openNew} aria-label="Add bill">
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
        {over && (
          <Banner tone="red" icon="dots">
            Fixed bills exceed income by {gbp(summary.total_bills - summary.total_income)}
          </Banner>
        )}
        {saveError && <Banner tone="red" icon="x">{saveError}</Banner>}

        <div className={styles.content}>
          <Card pad={18} className={styles.totalCard}>
            <div className={styles.totalCardTop}>
              <div className={styles.totalCardLeft}>
                <div className={styles.totalLabel}>Total bills</div>
                <div className={styles.totalSub}>of {gbp(summary.total_income)} income</div>
              </div>
              <Money value={summary.total_bills} size="24px" weight={700} />
            </div>
            <div className={styles.totalCardBottom}>
              <span className={styles.surplusLabel}>Leaves as surplus</span>
              <Money value={summary.monthly_surplus} size="16px" weight={700} />
            </div>
          </Card>

          {groups.map(group => (
            <div key={group.category} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupTitle}>
                  <span className={styles.groupDot} style={{ background: group.dot }} />
                  {group.category}
                </span>
                <Money value={group.subtotal} size="13.5px" weight={700} />
              </div>
              <Card pad="2px 16px">
                {group.bills.map((b, i) => (
                  <Row
                    key={b.id}
                    label={b.label}
                    recurring={b.is_recurring}
                    sub={dueLabel(b.due_date)}
                    amount={b.amount}
                    onClick={readOnly ? undefined : () => openEdit(b)}
                    last={i === group.bills.length - 1}
                  />
                ))}
              </Card>
            </div>
          ))}

          {!readOnly && (
            <Button variant="secondary" full icon="plus" className={styles.addBtn} onClick={openNew}>
              Add bill
            </Button>
          )}
        </div>
      </div>

      {sheet !== null && (
        <ItemSheet
          mode="bill"
          item={sheet === 'new' ? null : sheet}
          onClose={closeSheet}
          onSave={handleSave}
          onDelete={sheet !== 'new' ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
