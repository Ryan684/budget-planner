/* ── screens-bills-accounts.jsx — Bills (grouped) & Accounts (recorded) ── */
const { CATEGORIES } = window.BUDGET;

/* 3 ── BILLS ─────────────────────────────────────────────────────── */
function Bills({ ctx }) {
  const { data, figs, openSheet, readOnly, month, go } = ctx;
  const over = figs.total_bills > figs.total_income;
  const used = CATEGORIES.filter((c) => data.bills.some((b) => b.category === c.key));
  const subtotal = (cat) => data.bills.filter((b) => b.category === cat).reduce((s, b) => s + (+b.amount || 0), 0);
  const dueLabel = (d) => (d ? `Due ${d}${d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th"}` : null);

  return (
    <>
      <NavHeader title="Bills" onBack={() => go("dashboard")} backLabel="Dashboard"
        right={!readOnly && <button className="bp-press" onClick={() => openSheet("bill")} style={{ color: "#fff", display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 99, background: "rgba(255,255,255,0.14)" }}><Icon name="plus" size={20} /></button>} />
      <div className="bp-scroll" style={{ flex: 1, background: "var(--bg)" }}>
        {readOnly && <ReadOnlyBanner label={month.label} />}
        {over && <Banner tone="red" icon="info">Fixed bills exceed income by {window.BUDGET.gbp(figs.total_bills - figs.total_income)}</Banner>}
        <div style={{ padding: "16px 16px 28px" }}>
          <Card pad={18} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink-2)" }}>Total bills</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 3 }}>of {window.BUDGET.gbp(figs.total_income)} income</div>
              </div>
              <Money value={figs.total_bills} tone={over ? "red" : undefined} size={24} weight={700} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-2)" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Leaves as surplus</span>
              <Money value={figs.surplus} tone={figs.surplus < 0 ? "red" : "green"} size={16} weight={700} />
            </div>
          </Card>

          {used.map((c) => {
            const rows = data.bills.filter((b) => b.category === c.key);
            return (
              <div key={c.key} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "2px 4px 8px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: c.dot }} />{c.key}
                  </span>
                  <Money value={subtotal(c.key)} size={13.5} weight={700} tone="grey" />
                </div>
                <Card pad="2px 16px">
                  {rows.map((b, i) => (
                    <Row key={b.id} label={b.label} recurring={b.recurring} sub={dueLabel(b.due)} amount={b.amount}
                      onClick={readOnly ? undefined : () => openSheet("bill", b)} last={i === rows.length - 1} />
                  ))}
                </Card>
              </div>
            );
          })}
          {!readOnly && <Button variant="secondary" full icon="plus" onClick={() => openSheet("bill")}>Add bill</Button>}
        </div>
      </div>
    </>
  );
}

/* 4 ── ACCOUNTS (manually recorded balances, not month-scoped) ────── */
function Accounts({ ctx }) {
  const { accounts, accountsTotal, openSheet, readOnly } = ctx;
  const { fmtAsOf, accountStale, staleCount } = window.BUDGET;
  const stale = staleCount(accounts);
  const empty = accounts.length === 0;

  return (
    <>
      <div style={{ background: "var(--navy)", color: "#fff", flexShrink: 0, padding: "52px 16px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ margin: 0, fontSize: 27, fontWeight: 700 }}>Accounts</h1>
          {!readOnly && <button className="bp-press" onClick={() => openSheet("account")} style={{ color: "#fff", display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 99, background: "rgba(255,255,255,0.16)" }}><Icon name="plus" size={20} /></button>}
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.62)", fontWeight: 500 }}>Total across all accounts</div>
          <Money value={accountsTotal} size={38} weight={700} style={{ color: "#fff", display: "block", marginTop: 2 }} />
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
            {empty ? "Nothing recorded yet" : `${accounts.length} account${accounts.length === 1 ? "" : "s"} · recorded manually`}
          </div>
        </div>
      </div>

      <div className="bp-scroll" style={{ flex: 1, background: "var(--bg)" }}>
        {stale > 0 && (
          <Banner tone="amber" icon="info">{stale} balance{stale === 1 ? "" : "s"} not updated in over 30 days</Banner>
        )}
        <div style={{ padding: "16px 16px 28px" }}>
          {empty ? (
            <Card pad={22} style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--navy-tint)", color: "var(--navy)", display: "grid", placeItems: "center", margin: "4px auto 16px" }}>
                <Icon name="wallet" size={30} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No balances recorded</div>
              <p style={{ margin: "0 auto 18px", fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5, maxWidth: 250 }}>
                Add each bank account and record its balance. Update them whenever you check your banking app.
              </p>
              {!readOnly && <Button variant="primary" icon="plus" onClick={() => openSheet("account")}>Add an account</Button>}
            </Card>
          ) : (
            <>
              <Card pad="6px 16px">
                {accounts.map((a, i) => {
                  const isStale = accountStale(a.asOf);
                  return (
                    <button key={a.id} className={readOnly ? "" : "bp-press"} onClick={readOnly ? undefined : () => openSheet("account", a)}
                      style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "13px 2px", borderBottom: i === accounts.length - 1 ? "none" : "1px solid var(--line-2)", background: "none" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, flexShrink: 0, background: isStale ? "var(--amber)" : "var(--green)" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
                          <span style={{ fontSize: 12.5, color: isStale ? "var(--amber)" : "var(--ink-3)", fontWeight: isStale ? 600 : 400 }}>{fmtAsOf(a.asOf)}</span>
                          {isStale && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--amber)", background: "var(--amber-bg)", padding: "1px 7px", borderRadius: 99, border: "1px solid var(--amber-line)" }}>Stale</span>
                          )}
                        </div>
                      </div>
                      <Money value={a.balance} size={15.5} weight={700} />
                      {!readOnly && <Icon name="chevR" size={16} style={{ color: "var(--ink-3)", marginLeft: -4, flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </Card>
              {!readOnly && <Button variant="secondary" full icon="plus" style={{ marginTop: 16 }} onClick={() => openSheet("account")}>Add account</Button>}
              <p style={{ margin: "16px 4px 0", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                Balances are recorded by hand, not synced. Tap an account to update it after checking your banking app.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Bills, Accounts });
