import { useAmendments } from '../hooks/useAmendments'
import { mapAmendment } from '../lib/amendments'
import { gbp } from '../lib/format'
import { NavHeader } from '../components/NavHeader'
import { Card } from '../components/Card'
import { StateView } from '../components/StateView'
import styles from './Amendments.module.css'

interface AmendmentsScreenProps {
  activeMonthId: number
  onBack: () => void
}

function formatValue(v: number | string | undefined): string {
  if (v === undefined) return '—'
  if (typeof v === 'number') return gbp(v)
  return String(v)
}

export function AmendmentsScreen({ activeMonthId, onBack }: AmendmentsScreenProps) {
  const { data, loading, error, refetch } = useAmendments(activeMonthId)

  if (loading) return <StateView loading />
  if (error) return <StateView error={error} onRetry={refetch} />

  const views = data.map(mapAmendment)

  return (
    <div className={styles.root}>
      <NavHeader title="Changes" onBack={onBack} backLabel="Dashboard" />
      <div className={styles.scroll}>
        <div className={styles.content}>
          {views.length === 0 ? (
            <div className={styles.emptyWrap}>No changes recorded for this month</div>
          ) : (
            views.map(v => (
              <Card key={v.id} pad={14} className={styles.entryCard}>
                <div className={styles.entryRow}>
                  <span className={`${styles.sourcePill} ${v.sourceLabel === 'Claude' ? styles.sourcePillClaude : styles.sourcePillUser}`}>
                    {v.sourceLabel}
                  </span>
                  <div className={styles.entryBody}>
                    <div>
                      <span className={styles.verb}>{v.verb}</span>
                      <span className={styles.entityTag}>{v.entityType}</span>
                    </div>
                    {(v.from !== undefined || v.to !== undefined) && (
                      <div className={styles.fromTo}>
                        {v.from !== undefined && <>{formatValue(v.from)} → </>}
                        {v.to !== undefined && formatValue(v.to)}
                      </div>
                    )}
                    {v.reason && <div className={styles.reason}>{v.reason}</div>}
                    <div className={styles.ts}>{v.tsLocal}</div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
