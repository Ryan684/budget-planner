/* ── app.jsx — state, routing, Claude engine, edit sheets ────────── */
const { compute, surplusStatus, gbp: G, CATEGORIES: CATS, uid: nid, accountsTotal: acctTotal } = window.BUDGET;

function nowTs() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `28 May · ${hh}:${mm}`;
}
const nextMonth = { id: "2026-06", label: "June 2026", short: "Jun" };

const figStrip = (f) => [
  { label: "Monthly surplus", value: f.surplus, tone: f.surplus < 0 ? "red" : undefined },
];

const CLAUDE_GREETING = {
  id: "c0", role: "claude", kind: "text",
  text: "Hi 👋 I can plan against this month’s budget and your recorded balances. Ask me anything, or tap a suggestion below.",
};
const SUGGESTIONS = [
  { key: "forecast", chip: "When do we hit £20k savings?", text: "If we save £500 a month from our surplus, when do we hit £20,000 in savings?" },
  { key: "savings",  chip: "Update savings to £9,400",    text: "Update Joint savings to £9,400" },
  { key: "boiler",   chip: "Add £120 boiler service",     text: "Add a £120 boiler service as a one-off bill" },
];

function initState(arg) {
  const B = window.BUDGET;
  const im = arg && arg.initialMonth;
  return {
    monthsOrder: [...B.MONTHS_ORDER],
    months: JSON.parse(JSON.stringify(B.MONTHS)),
    accounts: JSON.parse(JSON.stringify(B.ACCOUNTS)),
    activeMonthId: im || B.ACTIVE,
    editableMonthId: B.ACTIVE,
    amendments: [...B.AMENDMENTS],
    claude: { messages: [CLAUDE_GREETING], suggestions: [...SUGGESTIONS], awaiting: null, typing: false, hasWritten: false, undoStack: [] },
  };
}

function reducer(state, a) {
  const editId = state.editableMonthId;
  const curData = state.months[editId].data;
  const withData = (fn) => ({ ...state, months: { ...state.months, [editId]: { ...state.months[editId], data: fn(curData) } } });
  const addAmend = (s, entry) => ({ ...s, amendments: [{ id: nid("a"), ts: nowTs(), ...entry }, ...s.amendments] });
  const setClaude = (s, patch) => ({ ...s, claude: { ...s.claude, ...patch } });
  const pushMsg = (s, msg) => setClaude(s, { messages: [...s.claude.messages, { id: nid("m"), ...msg }] });

  switch (a.type) {
    case "ADD_ITEM": {
      const item = { id: nid(a.kind), ...a.item };
      let s = withData((d) => ({ ...d, [a.listKey]: [...d[a.listKey], item] }));
      s = addAmend(s, { source: "user", kind: "add", target: a.target, label: item.label, to: item.amount });
      return s;
    }
    case "UPDATE_ITEM": {
      const prev = curData[a.listKey].find((x) => x.id === a.id);
      let s = withData((d) => ({ ...d, [a.listKey]: d[a.listKey].map((x) => (x.id === a.id ? { ...x, ...a.patch } : x)) }));
      if (prev && a.patch.amount != null && +a.patch.amount !== +prev.amount)
        s = addAmend(s, { source: "user", kind: "update", target: a.target, label: a.patch.label || prev.label, from: +prev.amount, to: +a.patch.amount, reason: a.reason });
      return s;
    }
    case "DELETE_ITEM": {
      const prev = curData[a.listKey].find((x) => x.id === a.id);
      let s = withData((d) => ({ ...d, [a.listKey]: d[a.listKey].filter((x) => x.id !== a.id) }));
      s = addAmend(s, { source: "user", kind: "delete", target: a.target, label: prev ? prev.label : "", from: prev ? prev.amount : null });
      return s;
    }
    case "ADD_ACCOUNT": {
      const acc = { id: nid("ac"), label: a.patch.label, balance: +a.patch.balance || 0, asOf: window.BUDGET.TODAY };
      let s = { ...state, accounts: [...state.accounts, acc] };
      s = addAmend(s, { source: "user", kind: "add", target: "Account", label: acc.label, to: acc.balance });
      return s;
    }
    case "UPDATE_ACCOUNT": {
      const prev = state.accounts.find((x) => x.id === a.id);
      const next = { ...prev, label: a.patch.label, balance: +a.patch.balance, asOf: window.BUDGET.TODAY };
      let s = { ...state, accounts: state.accounts.map((x) => (x.id === a.id ? next : x)) };
      if (prev && +a.patch.balance !== +prev.balance)
        s = addAmend(s, { source: "user", kind: "update", target: "Account", label: next.label, from: +prev.balance, to: +a.patch.balance, reason: "Checked banking app" });
      return s;
    }
    case "DELETE_ACCOUNT": {
      const prev = state.accounts.find((x) => x.id === a.id);
      let s = { ...state, accounts: state.accounts.filter((x) => x.id !== a.id) };
      s = addAmend(s, { source: "user", kind: "delete", target: "Account", label: prev ? prev.label : "", from: prev ? prev.balance : null });
      return s;
    }

    case "SWITCH_MONTH":
      return { ...state, activeMonthId: a.id };

    case "CREATE_MONTH": {
      const data = { income: [], bills: [] };
      a.items.forEach((it) => {
        if (it.type === "income") data.income.push({ id: nid("i"), label: it.label, amount: +it.amount || 0, recurring: true });
        else if (it.type === "bill") data.bills.push({ id: nid("b"), label: it.label, amount: +it.amount || 0, category: it.category, due: it.due, recurring: true });
      });
      return {
        ...state,
        monthsOrder: [...state.monthsOrder, nextMonth.id],
        months: { ...state.months, [nextMonth.id]: { ...nextMonth, data } },
        activeMonthId: nextMonth.id, editableMonthId: nextMonth.id,
        amendments: [{ id: nid("a"), ts: nowTs(), source: "user", kind: "create", target: "Month", label: `${nextMonth.label} created`, reason: `Carried forward ${a.items.length} items from May 2026` }],
        claude: { ...state.claude, messages: [CLAUDE_GREETING], suggestions: [...SUGGESTIONS], awaiting: null, typing: false, hasWritten: false, undoStack: [] },
      };
    }

    // ── Claude ──
    case "CLAUDE_TYPING": return setClaude(state, { typing: a.on });
    case "CLAUDE_USER": {
      let s = pushMsg(state, { role: "user", text: a.text });
      s = setClaude(s, { suggestions: s.claude.suggestions.filter((x) => x.key !== a.key) });
      return s;
    }
    case "CLAUDE_SAY": return pushMsg(state, { role: "claude", kind: "text", text: a.text });
    case "CLAUDE_ASK": {
      const id = nid("m");
      const s = setClaude(state, { messages: [...state.claude.messages, { id, role: "claude", kind: "question", text: a.text, options: a.options }], awaiting: { msgId: id, op: a.op } });
      return s;
    }
    case "CLAUDE_APPLY": {
      // apply a write, then craft an action bubble with live figures
      let s = state, amendId = nid("a"), undo, figures;
      if (a.op.kind === "addBill") {
        const item = { id: nid("b"), label: a.op.label, amount: a.op.amount, category: a.op.category, due: a.op.due || null, recurring: false };
        s = { ...s, months: { ...s.months, [editId]: { ...s.months[editId], data: { ...curData, bills: [...curData.bills, item] } } } };
        s = { ...s, amendments: [{ id: amendId, ts: nowTs(), source: "claude", kind: "add", target: "Bill", label: item.label, to: item.amount, reason: a.op.reason }, ...s.amendments] };
        undo = { kind: "removeBill", billId: item.id, amendId, label: item.label };
      } else if (a.op.kind === "updateBill") {
        const prev = curData.bills.find((b) => b.id === a.op.billId);
        s = { ...s, months: { ...s.months, [editId]: { ...s.months[editId], data: { ...curData, bills: curData.bills.map((b) => (b.id === a.op.billId ? { ...b, amount: a.op.amount } : b)) } } } };
        s = { ...s, amendments: [{ id: amendId, ts: nowTs(), source: "claude", kind: "update", target: "Bill", label: prev.label, from: prev.amount, to: a.op.amount, reason: a.op.reason }, ...s.amendments] };
        undo = { kind: "restoreBill", billId: a.op.billId, amount: prev.amount, amendId, label: prev.label };
      } else if (a.op.kind === "updateAccount") {
        const prev = state.accounts.find((x) => x.id === a.op.accId);
        s = { ...s, accounts: s.accounts.map((x) => (x.id === a.op.accId ? { ...x, balance: a.op.balance, asOf: window.BUDGET.TODAY } : x)) };
        s = { ...s, amendments: [{ id: amendId, ts: nowTs(), source: "claude", kind: "update", target: "Account", label: prev.label, from: prev.balance, to: a.op.balance, reason: a.op.reason }, ...s.amendments] };
        undo = { kind: "restoreAccount", accId: a.op.accId, balance: prev.balance, asOf: prev.asOf, amendId, label: prev.label };
      }
      const f = compute(s.months[editId].data);
      const accTotal = acctTotal(s.accounts);
      figures = a.op.kind === "updateAccount"
        ? [{ label: "Accounts total", value: accTotal }, { label: "Monthly surplus", value: f.surplus, tone: f.surplus < 0 ? "red" : undefined }]
        : figStrip(f);
      s = setClaude(s, {
        messages: [...s.claude.messages, { id: nid("m"), role: "claude", kind: "action", text: a.text({ f, accTotal }), figures }],
        hasWritten: true, undoStack: [...s.claude.undoStack, undo], awaiting: null,
      });
      return s;
    }
    case "CLAUDE_ANSWER": {
      return setClaude(state, { messages: state.claude.messages.map((m) => (m.id === a.msgId ? { ...m, answered: true, answeredValue: a.value } : m)), awaiting: null });
    }
    case "CLAUDE_UNDO": {
      const stack = state.claude.undoStack;
      if (!stack.length) return state;
      const u = stack[stack.length - 1];
      let data = state.months[editId].data;
      let accounts = state.accounts;
      if (u.kind === "removeBill") data = { ...data, bills: data.bills.filter((b) => b.id !== u.billId) };
      else if (u.kind === "restoreBill") data = { ...data, bills: data.bills.map((b) => (b.id === u.billId ? { ...b, amount: u.amount } : b)) };
      else if (u.kind === "restoreAccount") accounts = accounts.map((x) => (x.id === u.accId ? { ...x, balance: u.balance, asOf: u.asOf } : x));
      let s = { ...state, months: { ...state.months, [editId]: { ...state.months[editId], data } }, accounts, amendments: state.amendments.filter((x) => x.id !== u.amendId) };
      const f = compute(data);
      const revertMsg = u.kind === "restoreAccount"
        ? `Reverted my change to “${u.label}”. The balance is back to ${G(u.balance)}.`
        : `Reverted my last change to “${u.label}”. Your monthly surplus is back to ${G(f.surplus)}.`;
      s = setClaude(s, {
        messages: [...s.claude.messages, { id: nid("m"), role: "claude", kind: "text", text: revertMsg }],
        undoStack: stack.slice(0, -1),
      });
      if (!s.claude.undoStack.length) s = setClaude(s, { hasWritten: false });
      return s;
    }
    default: return state;
  }
}

/* ── edit / add sheet ─────────────────────────────────────────────── */
const LIST = { income: { listKey: "income", target: "Income" }, bill: { listKey: "bills", target: "Bill" } };

function ItemSheet({ kind, item, onClose, onSave, onDelete }) {
  const editing = !!item;
  const isAcc = kind === "account";
  const [label, setLabel] = React.useState(item ? item.label : "");
  const [amount, setAmount] = React.useState(item ? String(isAcc ? item.balance : item.amount) : "");
  const [recurring, setRecurring] = React.useState(item ? !!item.recurring : true);
  const [category, setCategory] = React.useState(item ? item.category : "Housing");
  const [due, setDue] = React.useState(item && item.due ? String(item.due) : "");
  const noun = kind === "income" ? "income" : kind === "bill" ? "bill" : "account";
  const title = (editing ? "Edit " : "Add ") + noun;
  const valid = label.trim() && amount !== "" && !isNaN(+amount);

  const save = () => {
    if (isAcc) { onSave({ label: label.trim(), balance: +amount }); return; }
    const patch = { label: label.trim(), amount: +amount };
    if (kind === "income") patch.recurring = recurring;
    if (kind === "bill") { patch.recurring = recurring; patch.category = category; patch.due = due ? +due : null; }
    onSave(patch);
  };

  return (
    <Sheet open title={title} onClose={onClose}
      footer={<Button variant="primary" full disabled={!valid} onClick={save}>{editing ? "Save changes" : `Add ${noun}`}</Button>}>
      <Field label={kind === "income" ? "Source" : kind === "bill" ? "Bill name" : "Account name"}>
        <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder={isAcc ? "e.g. Joint savings" : kind === "bill" ? "e.g. Boiler service" : "e.g. Freelance"} autoFocus={!editing} />
      </Field>
      <Field label={isAcc ? "Current balance" : "Amount (per month)"}>
        <MoneyInput value={amount} onChange={setAmount} autoFocus={false} />
      </Field>
      {isAcc && (
        <p style={{ margin: "-6px 2px 8px", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.45 }}>
          Saving records this balance as of today. Update it whenever you check your banking app.
        </p>
      )}
      {kind === "bill" && (
        <Field label="Category">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CATS.map((c) => (
              <button key={c.key} className="bp-press" onClick={() => setCategory(c.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 99, fontSize: 13.5, fontWeight: 600, border: category === c.key ? "1px solid var(--navy)" : "1px solid var(--line)", background: category === c.key ? "var(--navy)" : "var(--card)", color: category === c.key ? "#fff" : "var(--ink-2)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: c.dot }} />{c.key}
              </button>
            ))}
          </div>
        </Field>
      )}
      {kind === "bill" && (
        <Field label="Due day of month (optional)">
          <TextInput type="number" inputMode="numeric" value={due} onChange={(e) => setDue(e.target.value)} placeholder="e.g. 15" />
        </Field>
      )}
      {(kind === "income" || kind === "bill") && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 2px 4px" }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Recurring</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>Carries forward to next month</div>
          </div>
          <Toggle on={recurring} onClick={() => setRecurring((v) => !v)} />
        </div>
      )}
      {editing && (
        <Button variant="danger" full icon="trash" style={{ marginTop: 14 }} onClick={onDelete}>Delete {noun}</Button>
      )}
    </Sheet>
  );
}

/* ── App shell ────────────────────────────────────────────────────── */
function App({ initialScreen = "dashboard", initialMonth }) {
  const [state, dispatch] = React.useReducer(reducer, { initialMonth }, initState);
  const [screen, setScreen] = React.useState(initialScreen);
  const [sheet, setSheet] = React.useState(null); // {kind, item}

  const editId = state.editableMonthId;
  const month = state.months[state.activeMonthId];
  const data = month.data;
  const figs = compute(data);
  const readOnly = state.activeMonthId !== editId;
  const order = state.monthsOrder;
  const idx = order.indexOf(state.activeMonthId);

  const go = (s) => setScreen(s);
  const openSheet = (kind, item) => setSheet({ kind, item: item || null });
  const closeSheet = () => setSheet(null);

  const nav = {
    canPrev: idx > 0, canNext: idx < order.length - 1,
    prev: () => dispatch({ type: "SWITCH_MONTH", id: order[idx - 1] }),
    next: () => dispatch({ type: "SWITCH_MONTH", id: order[idx + 1] }),
  };

  // ── Claude orchestration (scripted, real writes) ──
  const claudeSend = (s) => {
    dispatch({ type: "CLAUDE_USER", text: s.text, key: s.key });
    dispatch({ type: "CLAUDE_TYPING", on: true });
    setTimeout(() => {
      dispatch({ type: "CLAUDE_TYPING", on: false });
      if (s.key === "forecast") {
        const sav = state.accounts.find((x) => /savings/i.test(x.label)) || state.accounts[0];
        const bal = sav ? sav.balance : 0;
        const months = Math.ceil(Math.max(0, 20000 - bal) / 500);
        const when = new Date(2026, 4 + months, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
        dispatch({ type: "CLAUDE_SAY", text: `Based on your current ${sav ? sav.label : "savings"} balance of ${G(bal)} and a £500/month contribution, you'd reach £20,000 in about ${months} months — around ${when}.` });
      } else if (s.key === "savings") {
        const sav = state.accounts.find((x) => /joint savings/i.test(x.label)) || state.accounts.find((x) => /savings/i.test(x.label));
        if (sav) {
          dispatch({ type: "CLAUDE_APPLY", op: { kind: "updateAccount", accId: sav.id, balance: 9400, reason: "Recorded via chat" },
            text: ({ accTotal }) => `Updated ${sav.label} to £9,400 (as of today). Your total across all accounts is now ${G(accTotal)}.` });
        }
      } else if (s.key === "boiler") {
        dispatch({ type: "CLAUDE_APPLY", op: { kind: "addBill", label: "Boiler service", amount: 120, category: "One-off", reason: "One-off via chat" },
          text: ({ f }) => `Added a £120 one-off bill: Boiler service, under One-off. That brings your monthly surplus to ${G(f.surplus)}.` });
      }
    }, 850);
  };

  const claudeChoose = (m, opt) => {
    dispatch({ type: "CLAUDE_ANSWER", msgId: m.id, value: opt.value });
    dispatch({ type: "CLAUDE_USER", text: opt.label });
    dispatch({ type: "CLAUDE_TYPING", on: true });
    setTimeout(() => {
      dispatch({ type: "CLAUDE_TYPING", on: false });
      dispatch({ type: "CLAUDE_APPLY", op: { kind: "updateBill", billId: opt.value, amount: 50, reason: "Updated via chat" },
        text: ({ f }) => `Updated ${opt.label} to £50. Your monthly surplus is now ${G(f.surplus)}.` });
    }, 850);
  };
  const claudeUndo = () => dispatch({ type: "CLAUDE_UNDO" });

  // ── sheet save/delete ──
  const onSheetSave = (patch) => {
    if (sheet.kind === "account") {
      if (sheet.item) dispatch({ type: "UPDATE_ACCOUNT", id: sheet.item.id, patch });
      else dispatch({ type: "ADD_ACCOUNT", patch });
      closeSheet(); return;
    }
    const meta = LIST[sheet.kind];
    if (sheet.item) dispatch({ type: "UPDATE_ITEM", listKey: meta.listKey, target: meta.target, id: sheet.item.id, patch });
    else dispatch({ type: "ADD_ITEM", listKey: meta.listKey, target: meta.target, item: patch });
    closeSheet();
  };
  const onSheetDelete = () => {
    if (sheet.kind === "account") { dispatch({ type: "DELETE_ACCOUNT", id: sheet.item.id }); closeSheet(); return; }
    const meta = LIST[sheet.kind];
    dispatch({ type: "DELETE_ITEM", listKey: meta.listKey, target: meta.target, id: sheet.item.id });
    closeSheet();
  };

  // ── create-month plumbing ──
  const carryItems = React.useMemo(() => {
    const d = state.months[editId].data;
    return [
      ...d.income.filter((i) => i.recurring).map((i) => ({ key: "inc_" + i.id, type: "income", label: i.label, amount: i.amount })),
      ...d.bills.filter((b) => b.recurring).map((b) => ({ key: "bill_" + b.id, type: "bill", label: b.label, amount: b.amount, category: b.category, due: b.due })),
    ];
  }, [state, editId, screen]);
  const confirmCreate = (items) => { dispatch({ type: "CREATE_MONTH", items }); setScreen("dashboard"); };

  const ctx = {
    data, figs, month, readOnly, nav, go, openSheet,
    accounts: state.accounts, accountsTotal: acctTotal(state.accounts),
    monthsOrder: order, months: state.months, activeMonthId: state.activeMonthId, editableMonthId: editId,
    switchMonth: (id) => dispatch({ type: "SWITCH_MONTH", id }), computeFor: compute,
    amendments: state.amendments,
    carryItems, confirmCreate, newMonthLabel: nextMonth.label,
    claude: state.claude, claudeSend, claudeChoose, claudeUndo,
  };

  const SCREENS = { dashboard: Dashboard, bills: Bills, accounts: Accounts, claude: Claude, income: Income, amendments: Amendments, months: Months, create: CreateMonth, empty: EmptyState };
  const Screen = SCREENS[screen] || Dashboard;
  const tabActive = ["dashboard", "bills", "accounts", "claude"].includes(screen) ? screen : "dashboard";
  const hideTab = screen === "create";

  return (
    <div className="bp-root" style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg)", position: "relative" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Screen ctx={ctx} />
      </div>
      {!hideTab && <TabBar active={tabActive} onChange={setScreen} badge={state.claude.hasWritten} />}
      {sheet && <ItemSheet kind={sheet.kind} item={sheet.item} onClose={closeSheet} onSave={onSheetSave} onDelete={onSheetDelete} />}
    </div>
  );
}

window.App = App;
