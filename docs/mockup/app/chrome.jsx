/* ── chrome.jsx — navy header & bottom tab bar ───────────────────── */

/* Navy top bar. Clears the dynamic island via top padding. */
function NavHeader({ title, onBack, backLabel, right, children, compact }) {
  return (
    <div style={{
      background: "var(--navy)", color: "#fff", flexShrink: 0,
      padding: "54px 16px 0", position: "relative", zIndex: 5,
    }}>
      <div style={{ display: "flex", alignItems: "center", minHeight: 36, gap: 8 }}>
        {onBack ? (
          <button className="bp-press" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#c5cee0", marginLeft: -6, fontSize: 15, fontWeight: 500 }}>
            <Icon name="chevL" size={22} />{backLabel || ""}
          </button>
        ) : <span />}
        <div style={{ flex: 1 }} />
        {right}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: compact ? "6px 2px 16px" : "6px 2px 18px", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h1>
      </div>
      {children}
    </div>
  );
}

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "bills",     label: "Bills",     icon: "bills" },
  { key: "accounts",  label: "Accounts",  icon: "wallet" },
  { key: "claude",    label: "Claude",    icon: "claude" },
];

function TabBar({ active, onChange, badge }) {
  return (
    <div style={{
      flexShrink: 0, background: "var(--navy)", borderTop: "1px solid rgba(255,255,255,0.08)",
      padding: "9px 6px 26px", display: "flex", position: "relative", zIndex: 5,
    }}>
      {TABS.map((t) => {
        const on = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} className="bp-press" style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            color: on ? "#fff" : "rgba(255,255,255,0.5)", position: "relative",
          }}>
            <span style={{ position: "relative" }}>
              <Icon name={t.icon} size={24} sw={on ? 2 : 1.7} />
              {t.key === "claude" && badge && (
                <span style={{ position: "absolute", top: -3, right: -5, width: 8, height: 8, borderRadius: 99, background: "var(--claude)", border: "1.5px solid var(--navy)" }} />
              )}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, letterSpacing: "0.01em" }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

window.NavHeader = NavHeader;
window.TabBar = TabBar;
window.TABS = TABS;
