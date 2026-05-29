/* ── screens-core.jsx — Dashboard, Income, Amendments, Months ────── */
const { gbp: fmt } = window.BUDGET;

function ReadOnlyBanner({ label }) {
  return <Banner tone="grey" icon="lock">Viewing {label} — read-only</Banner>;
}

/* Month switcher used in dashboard hero */
function MonthSwitcher({ month, nav, onOpen, light }) {
  const col = light ? "#fff" : "var(--ink)";
  const muted = light ? "rgba(255,255,255,0.45)" : "var(--ink-3)";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <button className="bp-press" onClick={nav.canPrev ? nav.prev : undefined} style={{ color: nav.canPrev ? (light ? "rgba(255,255,255,0.8)" : "var(--ink-2)") : muted, width: 30, height: 30, display: "grid", placeItems: "center", opacity: nav.canPrev ? 1 : 0.4 }}>
        <Icon name="chevL" size={22} />
      </button>
      <button className="bp-press" onClick={onOpen} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: col, fontSize: 16, fontWeight: 600 }}>
        {month.label}<Icon name="chevD" size={17} style={{ opacity: 0.7 }} />
      </button>
      <button className="bp-press" onClick={nav.canNext ? nav.next : undefined} style={{ color: nav.canNext ? (light ? "rgba(255,255,255,0.8)" : "var(--ink-2)") : muted, width: 30, height: 30, display: "grid", placeItems: "center", opacity: nav.canNext ? 1 : 0.4 }}>
        <Icon name="chevR" size={22} />
      </button>
    </div>
  );
}

/* Receipt-style calculation card: income − bills = monthly surplus */
function ReceiptCard({ figs }) {
  const sStat = window.BUDGET.surplusStatus(figs.surplus);
  const neg = figs.surplus < 0;
  const line = (label, value, opts = {}) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: opts.pad || "9px 0" }}>
      <span style={{ fontSize: opts.big ? 15.5 : 14.5, fontWeight: opts.big ? 700 : 500, color: opts.muted ? "var(--ink-2)" : "var(--ink)" }}>{label}</span>
      <Money value={value} plus={opts.plus} tone={opts.tone} size={opts.big ? 19 : 15.5} weight={opts.big ? 700 : 600} />
    </div>
  );
  const rule = (heavy) => <div style={{ borderTop: `1px ${heavy ? "solid" : "dashed"} var(--line)`, margin: "1px 0" }} />;
  return (
    <Card pad={18}>
      {line("Total income", figs.total_income, { plus: true, tone: "green" })}
      {line("Fixed bills", -figs.total_bills, { tone: "grey" })}
      {rule(true)}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 11, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, whiteSpace: "nowrap" }}>Monthly surplus</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3, whiteSpace: "nowrap" }}>What's left after bills</div>
        </div>
        <Money value={figs.surplus} tone={neg ? "red" : undefined} size={26} weight={700} />
      </div>
      {neg && <div style={{ fontSize: 12.5, color: "var(--red)", fontWeight: 600, marginTop: 6 }}>Bills exceed income — trim a bill to balance.</div>}
    </Card>
  );
}

/* 1 ── DASHBOARD ─────────────────────────────────────────────────── */
function Dashboard({ ctx }) {
  const { figs, data, month, nav, go, readOnly, accounts, accountsTotal } = ctx;
  const sStat = window.BUDGET.surplusStatus(figs.surplus);
  const neg = figs.surplus < 0;
  const stale = window.BUDGET.staleCount(accounts);
  return (
    <>
      <div style={{ background: neg ? "#7d2b22" : "var(--navy)", color: "#fff", flexShrink: 0, padding: "52px 16px 20px", transition: "background .25s ease" }}>
        <MonthSwitcher month={month} nav={nav} onOpen={() => go("months")} light />
        <div style={{ marginTop: 20, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>Monthly surplus</div>
            <Money value={figs.surplus} size={40} weight={700} style={{ color: "#fff", display: "block", marginTop: 2 }} />
          </div>
          <StatusPill tone={sStat.tone} style={{ marginBottom: 6 }}>{sStat.label}</StatusPill>
        </div>
        <div style={{ marginTop: 16 }}>
          <SurplusBar totalIncome={figs.total_income} totalBills={figs.total_bills} height={12} onDark />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, fontSize: 12.5, color: "rgba(255,255,255,0.66)" }}>
            <span>Bills <span className="num" style={{ color: "#fff", fontWeight: 600 }}>{fmt(figs.total_bills)}</span></span>
            <span>of <span className="num" style={{ color: "#fff", fontWeight: 600 }}>{fmt(figs.total_income)}</span> income</span>
          </div>
        </div>
      </div>

      <div className="bp-scroll" style={{ flex: 1, background: "var(--bg)" }}>
        {readOnly && <ReadOnlyBanner label={month.label} />}
        <div style={{ padding: "16px 16px 28px" }}>
          <SectionLabel>This month</SectionLabel>
          <ReceiptCard figs={figs} />

          <div style={{ height: 22 }} />
          <SectionLabel action={<button className="bp-press" onClick={() => go("accounts")} style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>View all</button>}>Account balances</SectionLabel>
          <Card pad={16} onClick={() => go("accounts")}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 600, whiteSpace: "nowrap" }}>Total across {accounts.length} account{accounts.length === 1 ? "" : "s"}</div>
                <Money value={accountsTotal} size={26} weight={700} style={{ display: "block", marginTop: 3 }} />
              </div>
              <Icon name="chevR" size={18} style={{ color: "var(--ink-3)" }} />
            </div>
            {stale > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-2)", color: "var(--amber)", fontSize: 12.5, fontWeight: 600 }}>
                <Icon name="info" size={14} /> {stale} balance{stale === 1 ? "" : "s"} not updated in over 30 days
              </div>
            )}
          </Card>

          <div style={{ height: 22 }} />
          <button className="bp-press" onClick={() => go("claude")} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: "var(--r-card)", background: "linear-gradient(120deg, #25335a, #1e2a4a)", color: "#fff", border: "none" }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.12)", display: "grid", placeItems: "center", flexShrink: 0, color: "#cdbbff" }}><Icon name="claude" size={24} /></span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>Ask Claude</span>
              <span style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,0.66)", marginTop: 2 }}>Plan, adjust or forecast in plain English</span>
            </span>
            <Icon name="chevR" size={20} style={{ color: "rgba(255,255,255,0.6)" }} />
          </button>

          <div style={{ height: 22 }} />
          <SectionLabel>Manage</SectionLabel>
          <Card pad="2px 16px">
            <Row label="Income" sub={`${data.income.length} entries`} onClick={() => go("income")} right={<Money value={figs.total_income} tone="green" size={15} />} />
            <Row label="Amendments log" sub="Every change this month" onClick={() => go("amendments")} />
            <Row label="Months" sub={month.label} onClick={() => go("months")} last />
          </Card>
        </div>
      </div>
    </>
  );
}

/* 2 ── INCOME ────────────────────────────────────────────────────── */
function Income({ ctx }) {
  const { data, figs, go, openSheet, readOnly, month } = ctx;
  return (
    <>
      <NavHeader title="Income" onBack={() => go("dashboard")} backLabel="Dashboard"
        right={!readOnly && <button className="bp-press" onClick={() => openSheet("income")} style={{ color: "#fff", display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 99, background: "rgba(255,255,255,0.14)" }}><Icon name="plus" size={20} /></button>} />
      <div className="bp-scroll" style={{ flex: 1, background: "var(--bg)" }}>
        {readOnly && <ReadOnlyBanner label={month.label} />}
        <div style={{ padding: "16px 16px 28px" }}>
          <Card pad={18} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink-2)" }}>Total income</span>
            <Money value={figs.total_income} tone="green" size={24} weight={700} />
          </Card>
          <Card pad="2px 16px">
            {data.income.map((it, i) => (
              <Row key={it.id} label={it.label} recurring={it.recurring} sub={it.recurring ? "Recurring" : "One-off this month"} amount={it.amount} amountTone="green"
                onClick={readOnly ? undefined : () => openSheet("income", it)} last={i === data.income.length - 1} />
            ))}
          </Card>
          {!readOnly && <Button variant="secondary" full icon="plus" style={{ marginTop: 16 }} onClick={() => openSheet("income")}>Add income</Button>}
        </div>
      </div>
    </>
  );
}

/* 6 ── AMENDMENTS LOG ────────────────────────────────────────────── */
function Amendments({ ctx }) {
  const { amendments, go, month } = ctx;
  const srcMeta = (s) => s === "claude"
    ? { tone: "claude", label: "Claude", icon: "claude" }
    : { tone: "navy", label: "You", icon: "edit" };
  const verb = (k) => ({ create: "Created", add: "Added", update: "Updated", delete: "Removed" }[k] || "Changed");
  return (
    <>
      <NavHeader title="Amendments" onBack={() => go("dashboard")} backLabel="Dashboard" />
      <div className="bp-scroll" style={{ flex: 1, background: "var(--bg)" }}>
        <div style={{ padding: "16px 16px 28px" }}>
          <p style={{ margin: "0 4px 14px", fontSize: 13, color: "var(--ink-3)" }}>{amendments.length} recent change{amendments.length === 1 ? "" : "s"}</p>
          <div style={{ position: "relative" }}>
            {amendments.map((a) => {
              const m = srcMeta(a.source);
              const t = window.toneOf(m.tone);
              return (
                <Card key={a.id} pad={14} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px 3px 7px", borderRadius: 99, background: t.bg, color: t.fg, fontSize: 12, fontWeight: 700, border: `1px solid ${t.line}` }}>
                      <Icon name={m.icon} size={13} />{m.label}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{a.ts}</span>
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                    {verb(a.kind)} <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{a.target.toLowerCase()}</span> · {a.label}
                  </div>
                  {(a.from != null || a.to != null) && a.kind === "update" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <Money value={a.from} tone="grey" size={14} weight={500} style={{ textDecoration: "line-through", opacity: 0.7 }} />
                      <Icon name="arrowR" size={14} style={{ color: "var(--ink-3)" }} />
                      <Money value={a.to} size={14} weight={700} />
                    </div>
                  )}
                  {a.to != null && (a.kind === "add") && (
                    <div style={{ marginTop: 6 }}><Money value={a.to} size={14} weight={700} /></div>
                  )}
                  {a.reason && <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 7, lineHeight: 1.4 }}>“{a.reason}”</div>}
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* 7a ── MONTHS LIST ──────────────────────────────────────────────── */
function Months({ ctx }) {
  const { monthsOrder, months, activeMonthId, editableMonthId, switchMonth, go, figs, computeFor } = ctx;
  return (
    <>
      <NavHeader title="Months" onBack={() => go("dashboard")} backLabel="Dashboard" />
      <div className="bp-scroll" style={{ flex: 1, background: "var(--bg)" }}>
        <div style={{ padding: "16px 16px 28px" }}>
          <Button variant="primary" full icon="plus" onClick={() => go("create")} style={{ marginBottom: 18 }}>Create new month</Button>
          {[...monthsOrder].reverse().map((id) => {
            const m = months[id];
            const f = computeFor(m.data);
            const isCurrent = id === editableMonthId;
            const isActive = id === activeMonthId;
            const st = window.BUDGET.surplusStatus(f.surplus);
            return (
              <Card key={id} pad={16} onClick={() => { switchMonth(id); go("dashboard"); }} style={{ marginBottom: 10, outline: isActive ? "2px solid var(--navy)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ fontSize: 16.5, fontWeight: 700 }}>{m.label}</span>
                    {isCurrent
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", background: "var(--green-bg)", padding: "2px 8px", borderRadius: 99, border: "1px solid var(--green-line)" }}>Current</span>
                      : <Icon name="lock" size={14} style={{ color: "var(--ink-3)" }} />}
                  </div>
                  <Icon name="chevR" size={18} style={{ color: "var(--ink-3)" }} />
                </div>
                <div style={{ display: "flex", gap: 22, marginTop: 12 }}>
                  <Mini label="Income" value={f.total_income} />
                  <Mini label="Surplus" value={f.surplus} tone={f.surplus < 0 ? "red" : undefined} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
function Mini({ label, value, tone }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <Money value={value} tone={tone} size={16} weight={700} />
    </div>
  );
}

/* 7b ── CREATE MONTH (carry-forward) ─────────────────────────────── */
function CreateMonth({ ctx }) {
  const { carryItems, confirmCreate, go, newMonthLabel } = ctx;
  const [items, setItems] = React.useState(carryItems);
  const [excluded, setExcluded] = React.useState({});
  const total = items.reduce((s, it) => s + (excluded[it.key] ? 0 : (+it.amount || 0)) * (it.type === "income" ? 1 : -1), 0);
  const upd = (key, amount) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, amount } : x)));
  const groups = [["income", "Income"], ["bill", "Fixed bills"]];
  return (
    <>
      <NavHeader title={`New month`} onBack={() => go("months")} backLabel="Months" />
      <div className="bp-scroll" style={{ flex: 1, background: "var(--bg)" }}>
        <div style={{ padding: "16px 16px 28px" }}>
          <Card pad={16} style={{ marginBottom: 16, background: "var(--navy-tint)", border: "1px solid var(--line)" }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>Carry forward to {newMonthLabel}</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.45 }}>These recurring items came from your last month. Untick anything to skip, or amend the amounts before confirming.</div>
          </Card>
          {groups.map(([type, title]) => {
            const rows = items.filter((it) => it.type === type);
            if (!rows.length) return null;
            return (
              <div key={type} style={{ marginBottom: 16 }}>
                <SectionLabel>{title}</SectionLabel>
                <Card pad="2px 16px">
                  {rows.map((it, i) => {
                    const off = excluded[it.key];
                    return (
                      <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 2px", borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--line-2)", opacity: off ? 0.4 : 1 }}>
                        <button className="bp-press" onClick={() => setExcluded((e) => ({ ...e, [it.key]: !e[it.key] }))} style={{ width: 22, height: 22, borderRadius: 6, border: off ? "1.5px solid var(--line)" : "none", background: off ? "transparent" : "var(--navy)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          {!off && <Icon name="check" size={15} />}
                        </button>
                        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500 }}>{it.label}</span>
                        <div style={{ width: 96 }}>
                          <MoneyInput value={it.amount} onChange={(v) => upd(it.key, v)} />
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: "12px 16px 24px", background: "var(--card)", borderTop: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13.5 }}>
          <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>Projected surplus</span>
          <Money value={total} size={16} weight={700} tone={total < 0 ? "red" : undefined} />
        </div>
        <Button variant="primary" full onClick={() => confirmCreate(items.filter((it) => !excluded[it.key]))}>Create {newMonthLabel}</Button>
      </div>
    </>
  );
}

/* EMPTY STATE — no month yet */
function EmptyState({ ctx }) {
  return (
    <>
      <div style={{ background: "var(--navy)", flexShrink: 0, padding: "52px 16px 18px", color: "#fff" }}>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 700 }}>Budget</h1>
      </div>
      <div style={{ flex: 1, background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 32px" }}>
        <div style={{ width: 76, height: 76, borderRadius: 22, background: "var(--navy-tint)", display: "grid", placeItems: "center", color: "var(--navy)", marginBottom: 22 }}>
          <Icon name="calendar" size={36} />
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700 }}>No budget yet</h2>
        <p style={{ margin: "0 0 26px", fontSize: 15, color: "var(--ink-2)", lineHeight: 1.5, maxWidth: 280 }}>
          Start by creating your first month. Add your income and fixed bills to see your monthly surplus.
        </p>
        <Button variant="primary" icon="plus" onClick={() => ctx.go("create")}>Create your first month</Button>
      </div>
    </>
  );
}

Object.assign(window, { Dashboard, Income, Amendments, Months, CreateMonth, EmptyState, ReadOnlyBanner });
