import { useState } from 'react'
import { Sheet } from './Sheet'
import { Field } from './Field'
import { TextInput } from './TextInput'
import { MoneyInput } from './MoneyInput'
import { Toggle } from './Toggle'
import { Button } from './Button'
import { SUGGESTED_CATEGORIES } from '../lib/categories'
import styles from './ItemSheet.module.css'

export type ItemSheetMode = 'income' | 'bill' | 'account'

interface IncomeItem {
  id: number
  label: string
  amount: number
  is_recurring: boolean
}

interface BillItem {
  id: number
  label: string
  amount: number
  category: string
  is_recurring: boolean
  due_date: number | null
}

interface AccountItem {
  id: number
  label: string
  balance: number
}

export type SheetItem = IncomeItem | BillItem | AccountItem

function isBillItem(item: SheetItem | null, mode: ItemSheetMode): item is BillItem {
  return mode === 'bill' && item !== null
}

interface ItemSheetProps {
  mode: ItemSheetMode
  item?: SheetItem | null
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  onDelete?: () => void
}

export function ItemSheet({ mode, item, onClose, onSave, onDelete }: ItemSheetProps) {
  const editing = !!item
  const isAcc = mode === 'account'
  const isBill = mode === 'bill'

  const [label, setLabel] = useState(item ? item.label : '')
  const [amount, setAmount] = useState(
    item
      ? String(isAcc ? (item as AccountItem).balance : (item as IncomeItem).amount)
      : ''
  )
  const [recurring, setRecurring] = useState(
    item && !isAcc ? !!(item as IncomeItem).is_recurring : true
  )
  const [category, setCategory] = useState(
    isBillItem(item ?? null, mode) ? (item as BillItem).category : SUGGESTED_CATEGORIES[0].label
  )
  const [due, setDue] = useState(
    isBill && item ? String((item as BillItem).due_date ?? '') : ''
  )

  const amtNum = parseFloat(amount)
  const valid =
    label.trim().length > 0 &&
    amount !== '' &&
    !isNaN(amtNum) &&
    amtNum >= 0 &&
    (!isBill || due === '' || (Number.isInteger(Number(due)) && Number(due) >= 1 && Number(due) <= 31))

  const noun = mode === 'income' ? 'income' : mode === 'bill' ? 'bill' : 'account'
  const title = (editing ? 'Edit ' : 'Add ') + noun

  const handleSave = () => {
    if (!valid) return
    if (isAcc) {
      onSave({ label: label.trim(), balance: amtNum })
      return
    }
    const data: Record<string, unknown> = { label: label.trim(), amount: amtNum }
    if (!isAcc) data.is_recurring = recurring
    if (isBill) {
      data.category = category
      data.due_date = due !== '' ? Number(due) : null
    }
    onSave(data)
  }

  return (
    <Sheet
      open
      title={title}
      onClose={onClose}
      footer={
        <Button variant="primary" full disabled={!valid} onClick={handleSave}>
          {editing ? 'Save changes' : `Add ${noun}`}
        </Button>
      }
    >
      <Field label={mode === 'income' ? 'Source' : mode === 'bill' ? 'Bill name' : 'Account name'}>
        <TextInput
          value={label}
          onChange={setLabel}
          placeholder={
            isAcc ? 'e.g. Joint savings' : mode === 'bill' ? 'e.g. Boiler service' : 'e.g. Freelance'
          }
          autoFocus={!editing}
        />
      </Field>

      <Field label={isAcc ? 'Current balance' : 'Amount (per month)'}>
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>

      {isAcc && (
        <p className={styles.accountNote}>
          Saving records this balance as of today. Update it whenever you check your banking app.
        </p>
      )}

      {isBill && (
        <Field label="Category">
          <div className={styles.categoryGrid}>
            {SUGGESTED_CATEGORIES.map(c => (
              <button
                key={c.label}
                type="button"
                className={`${styles.categoryChip} ${category === c.label ? styles.categoryChipActive : ''}`}
                onClick={() => setCategory(c.label)}
              >
                <span className={styles.categoryDot} style={{ background: c.dot }} />
                {c.label}
              </button>
            ))}
          </div>
        </Field>
      )}

      {isBill && (
        <Field label="Due day of month (optional)">
          <TextInput
            value={due}
            onChange={setDue}
            placeholder="e.g. 15"
          />
        </Field>
      )}

      {!isAcc && (
        <div className={styles.recurringRow}>
          <div>
            <div className={styles.recurringLabel}>Recurring</div>
            <div className={styles.recurringSub}>Carries forward to next month</div>
          </div>
          <Toggle on={recurring} onClick={() => setRecurring(v => !v)} label="Recurring" />
        </div>
      )}

      {editing && onDelete && (
        <Button
          variant="danger"
          full
          icon="trash"
          onClick={onDelete}
          className={styles.deleteBtn}
        >
          Delete {noun}
        </Button>
      )}
    </Sheet>
  )
}
