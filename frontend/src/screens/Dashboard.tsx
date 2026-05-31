import { useMonthDetail } from '../hooks/useMonthDetail'
import { useAccounts } from '../hooks/useAccounts'
import { isStale } from '../lib/dates'
import { gbp } from '../lib/format'
import { Money } from '../components/Money'
import { Card } from '../components/Card'
import { SectionLabel } from '../components/SectionLabel'
import { Row } from '../components/Row'
import { Banner } from '../components/Banner'
import { StatusPill } from '../components/StatusPill'
import { SurplusBar } from '../components/SurplusBar'
import { StateView } from '../components/StateView'
import { Icon } from '../components/Icon'
import type { ScreenName } from '../App'
import styles from './Dashboard.module.css'

interface DashboardScreenProps {
  activeMonthId: number
  editableMonthId: number
  readOnly: boolean
  go: (screen: ScreenName) => void
}

function surplusStatus(surplus: number): { tone: 'green' | 'amber' | 'red'; label: string } {
  if (surplus > 0) return { tone: 'green', label: 'On track' }
  if (surplus === 0) return { tone: 'amber', label: 'Break even' }
  return { tone: 'red', label: 'Over budget' }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function dueLabel(d: number | null): string | undefined {
  return d ? `Due ${ordinal(d)}` : undefined
}

export function DashboardScreen({
  activeMonthId,
  editableMonthId: _editableMonthId,
  readOnly,
  go,
}: DashboardScreenProps) {
  const detail = useMonthDetail(activeMonthId)
  const accounts = useAccounts()

  if (detail.loading || accounts.loading) return <StateView loading />
  if (detail.error) return <StateView error={detail.error} onRetry={detail.refetch} />

  const data = detail.data!
  const { summary, income, bills } = data
  const surplus = summary.monthly_surplus
  const negative = surplus < 0
  const sStat = surplusStatus(surplus)

  const acctData = accounts.data
  const totalBalances = acctData?.total_balances ?? 0
  const acctList = acctData?.accounts ?? []
  const staleCount = acctList.filter(a => isStale(a.as_of_date)).length

  const monthLabel = data.month.month
  const [year, mon] = monthLabel.split('-')
  const displayMonth = new Date(Number(year), Number(mon) - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div className={styles.root}>
      {/* ── Hero ── */}
      <div className={`${styles.hero} ${negative ? styles.heroNegative : ''}`}>
        {/* Month switcher */}
        <div className={styles.monthSwitcher}>
          <button
            type="button"
            className={styles.monthNavBtn}
            onClick={() => go('months')}
            style={{ color: 'rgba(255,255,255,0.8)' }}
            aria-label="Previous month"
          >
            <Icon name="chevL" size={22} />
          </button>
          <button
            type="button"
            className={styles.monthLabel}
            onClick={() => go('months')}
          >
            {displayMonth}
            <Icon name="chevDown" size={17} style={{ opacity: 0.7 }} />
          </button>
          <button
            type="button"
            className={styles.monthNavBtn}
            onClick={() => go('months')}
            style={{ color: 'rgba(255,255,255,0.8)' }}
            aria-label="Next month"
          >
            <Icon name="chevR" size={22} />
          </button>
        </div>

        {/* Surplus + pill */}
        <div className={styles.surplusRow}>
          <div>
            <div className={styles.surplusLabel}>Monthly surplus</div>
            <span className={`num ${styles.surplusValue}`}>{gbp(surplus)}</span>
          </div>
          <StatusPill tone={sStat.tone}>{sStat.label}</StatusPill>
        </div>

        {/* Bills-of-income bar */}
        <div className={styles.barSection}>
          <SurplusBar
            totalIncome={summary.total_income}
            totalBills={summary.total_bills}
            height={12}
            onDark
          />
          <div className={styles.barLegend}>
            <span>
              Bills{' '}
              <span className={`num ${styles.barLegendNum}`}>{gbp(summary.total_bills)}</span>
            </span>
            <span>
              of{' '}
              <span className={`num ${styles.barLegendNum}`}>{gbp(summary.total_income)}</span>
              {' '}income
            </span>
          </div>
        </div>
      </div>

      {/* ── Scroll area ── */}
      <div className={styles.scroll}>
        {readOnly && (
          <Banner tone="amber" icon="lock">
            Viewing {displayMonth} — read-only
          </Banner>
        )}

        <div className={styles.content}>
          {/* Receipt card */}
          <SectionLabel>This month</SectionLabel>
          <Card pad={18}>
            <div className={styles.receiptLine}>
              <span className={`${styles.receiptLineLabel} ${styles.receiptLineLabelMuted}`}>
                Total income
              </span>
              <Money value={summary.total_income} size="15.5px" weight={600} />
            </div>
            <div className={styles.receiptLine}>
              <span className={`${styles.receiptLineLabel} ${styles.receiptLineLabelMuted}`}>
                Fixed bills
              </span>
              <Money value={-summary.total_bills} size="15.5px" weight={600} />
            </div>
            <hr className={styles.receiptRule} />
            <div className={styles.receiptSurplusRow}>
              <div style={{ minWidth: 0 }}>
                <div className={styles.receiptSurplusLabel}>Monthly surplus</div>
                <div className={styles.receiptSurplusSub}>What's left after bills</div>
              </div>
              <Money value={surplus} size="26px" weight={700} />
            </div>
            {negative && (
              <div className={styles.receiptOverBudget}>
                Bills exceed income — trim a bill to balance.
              </div>
            )}
          </Card>

          <div className={styles.spacer22} />

          {/* Accounts card */}
          <SectionLabel
            action={
              <button
                type="button"
                className="bp-press"
                onClick={() => go('accounts')}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', background: 'none', cursor: 'pointer' }}
              >
                View all
              </button>
            }
          >
            Account balances
          </SectionLabel>
          <Card pad={16} onClick={() => go('accounts')}>
            <div className={styles.accountsCardInner}>
              <div className={styles.accountsCardLeft}>
                <div className={styles.accountsCardSub}>
                  Total across {acctList.length} account{acctList.length === 1 ? '' : 's'}
                </div>
                <Money value={totalBalances} size="26px" weight={700} />
              </div>
              <Icon name="chevR" size={18} style={{ color: 'var(--ink-3)' }} />
            </div>
            {staleCount > 0 && (
              <div className={styles.accountsStaleRow}>
                <Icon name="dots" size={14} />
                {staleCount} balance{staleCount === 1 ? '' : 's'} not updated in over 30 days
              </div>
            )}
          </Card>

          <div className={styles.spacer22} />

          {/* Ask Claude card */}
          <button
            type="button"
            className={styles.claudeCard}
            onClick={() => go('claude')}
          >
            <span className={styles.claudeIconBox}>
              <Icon name="claude" size={24} />
            </span>
            <span className={styles.claudeText}>
              <span className={styles.claudeTitle}>Ask Claude</span>
              <span className={styles.claudeSub}>Plan, adjust or forecast in plain English</span>
            </span>
            <Icon name="chevR" size={20} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>

          <div className={styles.spacer22} />

          {/* Manage list */}
          <SectionLabel>Manage</SectionLabel>
          <Card pad="2px 16px">
            <Row
              label="Income"
              sub={`${income.length} entries`}
              right={<Money value={summary.total_income} size="15px" weight={600} />}
              onClick={() => go('income')}
            />
            <Row
              label="Amendments log"
              sub="Every change this month"
              onClick={() => go('amendments')}
            />
            <Row
              label="Months"
              sub={displayMonth}
              onClick={() => go('months')}
              last
            />
          </Card>

          {/* Bills summary below manage */}
          {bills.length > 0 && (
            <>
              <div className={styles.spacer22} />
              <SectionLabel>Bills</SectionLabel>
              <Card pad="2px 16px">
                {bills.slice(0, 3).map((b, i) => (
                  <Row
                    key={b.id}
                    label={b.label}
                    sub={dueLabel(b.due_date)}
                    amount={b.amount}
                    dot={styles[`dot${b.category}`] ? undefined : '#8b93a2'}
                    onClick={() => go('bills')}
                    last={i === Math.min(bills.length, 3) - 1}
                  />
                ))}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
