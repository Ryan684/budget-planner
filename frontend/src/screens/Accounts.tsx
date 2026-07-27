import { useState } from 'react'
import { useAccounts } from '../hooks/useAccounts'
import { createAccount, updateAccount, deleteAccount } from '../api/accounts'
import type { AccountRead } from '../api/types'
import { Card } from '../components/Card'
import { Banner } from '../components/Banner'
import { Button } from '../components/Button'
import { StateView } from '../components/StateView'
import { ItemSheet } from '../components/ItemSheet'
import { Money } from '../components/Money'
import { Icon } from '../components/Icon'
import { isStale, fmtAsOf } from '../lib/dates'
import { gbp } from '../lib/format'
import styles from './Accounts.module.css'

interface AccountsScreenProps {
  /** null when the current calendar month has not been created yet. */
  editableMonthId: number | null
}

export function AccountsScreen({ editableMonthId }: AccountsScreenProps) {
  const { data, loading, error, refetch } = useAccounts()
  const [sheet, setSheet] = useState<AccountRead | null | 'new'>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (loading) return <StateView loading />
  if (error) return <StateView error={error} onRetry={refetch} />

  const accounts = data?.accounts ?? []
  const total = data?.total_balances ?? 0
  const staleCount = accounts.filter(a => isStale(a.as_of_date)).length
  const empty = accounts.length === 0

  const closeSheet = () => { setSheet(null); setSaveError(null) }

  const handleSave = async (payload: Record<string, unknown>) => {
    setSaveError(null)
    try {
      if (sheet === 'new') {
        await createAccount({
          label: payload.label as string,
          balance: payload.balance as number,
          active_month_id: editableMonthId,
        })
      } else if (sheet) {
        await updateAccount((sheet as AccountRead).id, {
          label: payload.label as string,
          balance: payload.balance as number,
          active_month_id: editableMonthId,
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
      await deleteAccount((sheet as AccountRead).id)
      closeSheet()
      refetch()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>Accounts</h1>
          <button
            type="button"
            className={styles.addHeaderBtn}
            onClick={() => setSheet('new')}
            aria-label="Add account"
          >
            <Icon name="plus" size={20} />
          </button>
        </div>
        <div className={styles.headerStats}>
          <div className={styles.headerStatsSub}>Total across all accounts</div>
          <span className={`num ${styles.totalValue}`} style={{ fontSize: 38, fontWeight: 700 }}>
            {gbp(total)}
          </span>
          <div className={styles.headerMeta}>
            {empty
              ? 'Nothing recorded yet'
              : `${accounts.length} account${accounts.length === 1 ? '' : 's'} · recorded manually`}
          </div>
        </div>
      </div>

      <div className={styles.scroll}>
        {staleCount > 0 && (
          <Banner tone="amber" icon="dots">
            {staleCount} balance{staleCount === 1 ? '' : 's'} not updated in over 30 days
          </Banner>
        )}
        {saveError && <Banner tone="red" icon="x">{saveError}</Banner>}

        <div className={styles.content}>
          {empty ? (
            <Card pad={22} className={styles.emptyCard}>
              <div className={styles.emptyIconBox}>
                <Icon name="wallet" size={30} />
              </div>
              <div className={styles.emptyTitle}>No balances recorded</div>
              <p className={styles.emptyDesc}>
                Add each bank account and record its balance. Update them whenever you check your banking app.
              </p>
              <Button variant="primary" icon="plus" onClick={() => setSheet('new')}>
                Add an account
              </Button>
            </Card>
          ) : (
            <>
              <Card pad="6px 16px">
                {accounts.map(a => {
                  const stale = isStale(a.as_of_date)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={styles.accountRow}
                      onClick={() => setSheet(a)}
                    >
                      <span className={`${styles.freshnessDot} ${stale ? styles.dotStale : styles.dotFresh}`} />
                      <div className={styles.accountBody}>
                        <div className={styles.accountLabel}>{a.label}</div>
                        <div className={styles.accountMeta}>
                          <span className={`${styles.accountAsOf} ${stale ? styles.accountAsOfStale : ''}`}>
                            {fmtAsOf(a.as_of_date)}
                          </span>
                          {stale && <span className={styles.stalePill}>Stale</span>}
                        </div>
                      </div>
                      <Money value={a.balance} size="15.5px" weight={700} />
                      <Icon name="chevR" size={16} style={{ color: 'var(--ink-3)', marginLeft: -4, flexShrink: 0 }} />
                    </button>
                  )
                })}
              </Card>
              <Button variant="secondary" full icon="plus" className={styles.addBtn} onClick={() => setSheet('new')}>
                Add account
              </Button>
              <p className={styles.note}>
                Balances are recorded by hand, not synced. Tap an account to update it after checking your banking app.
              </p>
            </>
          )}
        </div>
      </div>

      {sheet !== null && (
        <ItemSheet
          mode="account"
          item={sheet === 'new' ? null : sheet}
          onClose={closeSheet}
          onSave={handleSave}
          onDelete={sheet !== 'new' ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
