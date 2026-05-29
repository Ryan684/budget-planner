/* ── screens-claude.jsx — scripted assistant (3 bubble states) ───── */

function ClaudeAvatar({ size = 26 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 8, background: "var(--claude)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Icon name="claude" size={size * 0.66} />
    </span>
  );
}

function FiguresStrip({ items }) {
  return (
    <div style={{ display: "flex", gap: 18, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-2)" }}>
      {items.map((f, i) => (
        <div key={i}>
          <div style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>{f.label}</div>
          <Money value={f.value} tone={f.tone} size={15} weight={700} style={{ display: "block", marginTop: 2 }} />
        </div>
      ))}
    </div>
  );
}

function Bubble({ m, onChoose }) {
  if (m.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ maxWidth: "82%", background: "var(--navy)", color: "#fff", padding: "10px 14px", borderRadius: "16px 16px 5px 16px", fontSize: 14.5, lineHeight: 1.45 }}>{m.text}</div>
      </div>
    );
  }
  // claude side
  const inner = (() => {
    if (m.kind === "action") {
      return (
        <div style={{ background: "var(--card)", border: "1px solid var(--claude-line)", borderLeft: "3px solid var(--claude)", borderRadius: "5px 16px 16px 16px", padding: "12px 14px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "var(--claude)", background: "var(--claude-bg)", padding: "3px 9px", borderRadius: 99, marginBottom: 8, whiteSpace: "nowrap" }}>
            <Icon name="check" size={13} /> Change applied
          </span>
          <div style={{ fontSize: 14.5, lineHeight: 1.45, color: "var(--ink)" }}>{m.text}</div>
          {m.figures && <FiguresStrip items={m.figures} />}
        </div>
      );
    }
    if (m.kind === "question") {
      return (
        <div style={{ background: "var(--card)", border: "1px solid var(--amber-line)", borderRadius: "5px 16px 16px 16px", padding: "12px 14px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "var(--amber)", background: "var(--amber-bg)", padding: "3px 9px", borderRadius: 99, marginBottom: 8, whiteSpace: "nowrap" }}>
            <Icon name="question" size={13} /> Needs a quick answer
          </span>
          <div style={{ fontSize: 14.5, lineHeight: 1.45, color: "var(--ink)" }}>{m.text}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11 }}>
            {m.options.map((o) => {
              const chosen = m.answeredValue === o.value;
              const dim = m.answered && !chosen;
              return (
                <button key={o.value} className={m.answered ? "" : "bp-press"} disabled={m.answered}
                  onClick={() => !m.answered && onChoose(m, o)}
                  style={{ padding: "8px 13px", borderRadius: 10, fontSize: 13.5, fontWeight: 600,
                    border: chosen ? "1px solid var(--navy)" : "1px solid var(--line)",
                    background: chosen ? "var(--navy)" : "var(--card)", color: chosen ? "#fff" : "var(--navy)",
                    opacity: dim ? 0.4 : 1, cursor: m.answered ? "default" : "pointer" }}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    // conversational
    return (
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "5px 16px 16px 16px", padding: "11px 14px", fontSize: 14.5, lineHeight: 1.5, color: "var(--ink)" }}>{m.text}</div>
    );
  })();
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
      <ClaudeAvatar />
      <div style={{ maxWidth: "84%" }}>{inner}</div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
      <ClaudeAvatar />
      <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: "5px 16px 16px 16px", padding: "13px 16px", display: "flex", gap: 5 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 7, height: 7, borderRadius: 99, background: "var(--ink-3)", animation: `bp-dots 1.2s ${i * 0.18}s infinite ease-in-out` }} />
        ))}
      </div>
    </div>
  );
}

function Claude({ ctx }) {
  const { claude, claudeSend, claudeChoose, claudeUndo, go, month } = ctx;
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [claude.messages.length, claude.typing]);

  return (
    <>
      <NavHeader title="Claude" onBack={() => go("dashboard")} backLabel="Dashboard"
        right={claude.hasWritten && (
          <button className="bp-press" onClick={claudeUndo} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 99, background: "rgba(255,255,255,0.14)", color: "#fff", fontSize: 13, fontWeight: 600 }}>
            <Icon name="undo" size={16} /> <span style={{ whiteSpace: "nowrap" }}>Undo change</span>
          </button>
        )} />

      <div ref={scrollRef} className="bp-scroll" style={{ flex: 1, background: "var(--bg)" }}>
        <div style={{ padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-3)", margin: "2px 0 4px" }}>
            Assistant has full context of {month.label}
          </div>
          {claude.messages.map((m) => <Bubble key={m.id} m={m} onChoose={claudeChoose} />)}
          {claude.typing && <TypingBubble />}
        </div>
      </div>

      {/* suggestions + input */}
      <div style={{ flexShrink: 0, background: "var(--card)", borderTop: "1px solid var(--line)", padding: "10px 0 22px" }}>
        {!claude.awaiting && claude.suggestions.length > 0 && (
          <div className="bp-scroll" style={{ display: "flex", gap: 8, padding: "0 16px 10px", overflowX: "auto" }}>
            {claude.suggestions.map((s) => (
              <button key={s.key} className="bp-press" onClick={() => claudeSend(s)} style={{ flexShrink: 0, padding: "8px 13px", borderRadius: 99, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--navy)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                {s.chip}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px" }}>
          <div style={{ flex: 1, height: 46, borderRadius: 23, border: "1px solid var(--line)", background: "var(--bg)", display: "flex", alignItems: "center", padding: "0 16px", color: "var(--ink-3)", fontSize: 14.5 }}>
            {claude.awaiting ? "Choose an option above…" : "Try a suggestion…"}
          </div>
          <button className="bp-press" disabled style={{ width: 46, height: 46, borderRadius: 99, background: "var(--navy-tint)", color: "var(--navy)", display: "grid", placeItems: "center", opacity: 0.5 }}>
            <Icon name="send" size={20} />
          </button>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { Claude });
