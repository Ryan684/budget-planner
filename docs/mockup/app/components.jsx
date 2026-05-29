/* ── components.jsx — shared UI primitives ───────────────────────── */
const { gbp } = window.BUDGET;

const TONES = {
  green:  { fg: "var(--green)",  bg: "var(--green-bg)",  line: "var(--green-line)" },
  amber:  { fg: "var(--amber)",  bg: "var(--amber-bg)",  line: "var(--amber-line)" },
  red:    { fg: "var(--red)",    bg: "var(--red-bg)",    line: "var(--red-line)" },
  navy:   { fg: "var(--navy)",   bg: "var(--navy-tint)", line: "var(--line)" },
  claude: { fg: "var(--claude)", bg: "var(--claude-bg)", line: "var(--claude-line)" },
  grey:   { fg: "var(--ink-2)",  bg: "var(--line-2)",    line: "var(--line)" },
};
const toneOf = (t) => TONES[t] || TONES.grey;

/* Monetary figure */
function Money({ value, plus = false, tone, weight = 600, size, style }) {
  const col = tone ? toneOf(tone).fg : undefined;
  return (
    <span className="num" style={{ fontWeight: weight, color: col, fontSize: size, whiteSpace: "nowrap", ...style }}>
      {gbp(value, { plus })}
    </span>
  );
}

/* Small status pill */
function StatusPill({ tone = "navy", children, dot = true, style }) {
  const t = toneOf(tone);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 999, background: t.bg,
      color: t.fg, fontSize: 12.5, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap",
      border: `1px solid ${t.line}`, flexShrink: 0, ...style,
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: t.fg }} />}
      {children}
    </span>
  );
}

/* White card */
function Card({ children, style, pad = 16, onClick, className = "" }) {
  return (
    <div
      onClick={onClick}
      className={(onClick ? "bp-press " : "") + className}
      style={{
        background: "var(--card)", borderRadius: "var(--r-card)",
        border: "1px solid var(--line)", padding: pad,
        boxShadow: "0 1px 2px rgba(28,35,49,0.04)", ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", margin: "2px 4px 9px" }}>
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", whiteSpace: "nowrap" }}>{children}</span>
      {action}
    </div>
  );
}

/* Surplus bar: income split into fixed bills (filled) + surplus (light remainder) */
function SurplusBar({ totalIncome, totalBills, height = 12, onDark = false }) {
  const over = totalBills > totalIncome;
  const denom = over ? totalBills : Math.max(totalIncome, 1);
  const billsPct = Math.min(100, (totalBills / denom) * 100);
  const surplus = totalIncome - totalBills;
  const billFill = over ? "var(--red)" : (onDark ? "rgba(255,255,255,0.92)" : "var(--navy-500)");
  const track = onDark ? "rgba(255,255,255,0.16)" : "var(--line-2)";
  return (
    <div style={{ display: "flex", height, borderRadius: 999, overflow: "hidden", background: track }}>
      <div style={{ width: `${billsPct}%`, background: billFill }} />
      {!over && surplus > 0 && (
        <div style={{
          width: `${(surplus / denom) * 100}%`,
          background: onDark
            ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.30), rgba(255,255,255,0.30) 4px, rgba(255,255,255,0.16) 4px, rgba(255,255,255,0.16) 8px)"
            : "repeating-linear-gradient(45deg, var(--navy-tint), var(--navy-tint) 4px, #dfe4ee 4px, #dfe4ee 8px)",
        }} />
      )}
    </div>
  );
}

/* Generic list row */
function Row({ label, sub, amount, amountTone, recurring, dot, onClick, right, last, neg }) {
  return (
    <div onClick={onClick} className={onClick ? "bp-press" : ""} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "13px 2px",
      borderBottom: last ? "none" : "1px solid var(--line-2)", cursor: onClick ? "pointer" : "default",
    }}>
      {dot && <span style={{ width: 9, height: 9, borderRadius: 99, background: dot, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          {recurring && <Icon name="recurring" size={13} style={{ color: "var(--ink-3)", flexShrink: 0 }} />}
        </div>
        {sub && <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>{sub}</div>}
      </div>
      {right}
      {amount !== undefined && <Money value={neg ? -amount : amount} tone={amountTone} size={15} weight={600} />}
      {onClick && <Icon name="chevR" size={16} style={{ color: "var(--ink-3)", marginLeft: -4, flexShrink: 0 }} />}
    </div>
  );
}

/* Buttons */
function Button({ children, onClick, variant = "primary", icon, full, disabled, style }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    height: 50, padding: "0 18px", borderRadius: "var(--r-btn)", fontSize: 15.5, fontWeight: 600,
    width: full ? "100%" : undefined, opacity: disabled ? 0.45 : 1, whiteSpace: "nowrap",
    pointerEvents: disabled ? "none" : "auto",
  };
  const variants = {
    primary:   { background: "var(--navy)", color: "#fff" },
    secondary: { background: "var(--card)", color: "var(--navy)", border: "1px solid var(--line)" },
    ghost:     { background: "var(--navy-tint)", color: "var(--navy)" },
    danger:    { background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-line)" },
  };
  return (
    <button className="bp-press" onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={19} />}{children}
    </button>
  );
}

/* Read-only / warning banner */
function Banner({ tone = "amber", icon = "lock", children, style }) {
  const t = toneOf(tone);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 9, padding: "10px 14px",
      background: t.bg, color: t.fg, fontSize: 13.5, fontWeight: 600,
      borderBottom: `1px solid ${t.line}`, ...style,
    }}>
      <Icon name={icon} size={16} style={{ flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}

/* Bottom sheet (anchored to device, absolute) */
function Sheet({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(18,24,38,0.42)", animation: "bp-fade .18s ease" }} />
      <div style={{
        position: "relative", background: "var(--bg)", borderRadius: "22px 22px 0 0",
        maxHeight: "88%", display: "flex", flexDirection: "column",
        animation: "bp-sheet-in .26s cubic-bezier(.22,.9,.3,1)", boxShadow: "0 -10px 40px rgba(18,24,38,0.22)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px" }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{title}</span>
          <button className="bp-press" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 99, background: "var(--line-2)", display: "grid", placeItems: "center", color: "var(--ink-2)" }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="bp-scroll" style={{ padding: "0 18px 16px", flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: "12px 18px 20px", borderTop: "1px solid var(--line)", background: "var(--card)" }}>{footer}</div>}
      </div>
    </div>
  );
}

/* Labelled field + amount/text input used in sheets */
function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}
const inputStyle = {
  width: "100%", height: 48, padding: "0 14px", borderRadius: "var(--r-btn)",
  border: "1px solid var(--line)", background: "var(--card)", fontSize: 16, color: "var(--ink)",
};
function TextInput(props) { return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function MoneyInput({ value, onChange, autoFocus }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 48, borderRadius: "var(--r-btn)", border: "1px solid var(--line)", background: "var(--card)", overflow: "hidden" }}>
      <span className="num" style={{ padding: "0 4px 0 14px", color: "var(--ink-3)", fontSize: 17 }}>£</span>
      <input
        type="number" inputMode="decimal" value={value} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="num"
        style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 17, padding: "0 14px 0 2px", width: "100%", fontWeight: 600 }}
      />
    </div>
  );
}

/* Toggle switch */
function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} className="bp-press" style={{
      width: 50, height: 30, borderRadius: 99, padding: 3, display: "flex",
      justifyContent: on ? "flex-end" : "flex-start", background: on ? "var(--navy)" : "#cfd4de",
      transition: "background .18s ease",
    }}>
      <span style={{ width: 24, height: 24, borderRadius: 99, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
    </button>
  );
}

Object.assign(window, {
  TONES, toneOf, Money, StatusPill, Card, SectionLabel, SurplusBar,
  Row, Button, Banner, Sheet, Field, TextInput, MoneyInput, Toggle, inputStyle,
});
