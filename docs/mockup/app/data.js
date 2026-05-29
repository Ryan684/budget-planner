/* ── data.js — example UK family budget + calc & status helpers ──── */
(function () {
  "use strict";

  const uid = (p) => p + "_" + Math.random().toString(36).slice(2, 8);

  // Category metadata for bills (order + colour dot)
  const CATEGORIES = [
    { key: "Housing",   dot: "#3a4f82" },
    { key: "Utilities", dot: "#2f8f9d" },
    { key: "Childcare", dot: "#8a6cd1" },
    { key: "Transport", dot: "#c68a2e" },
    { key: "Insurance", dot: "#4a8a63" },
    { key: "One-off",   dot: "#9aa3b2" },
  ];

  // Reference "today" for the prototype (matches the amendment timestamps)
  const TODAY = "2026-05-28";

  // ── Manually recorded bank balances (NOT month-scoped) ──────────
  // The user records these when they check their banking app (~monthly).
  const ACCOUNTS = [
    { id: "ac1", label: "Joint current", balance: 2340,  asOf: "2026-05-28" }, // today
    { id: "ac2", label: "Joint savings", balance: 8900,  asOf: "2026-05-25" }, // 3 days ago
    { id: "ac3", label: "Ryan ISA",      balance: 14200, asOf: "2026-04-30" }, // 28 days — approaching
    { id: "ac4", label: "Robyn ISA",     balance: 6500,  asOf: "2026-04-13" }, // 45 days — stale
  ];

  // ── Current, editable month: May 2026 ──────────────────────────
  const may = {
    income: [
      { id: "i1", label: "Salary — Sarah", amount: 2450, recurring: true },
      { id: "i2", label: "Salary — James", amount: 1860, recurring: true },
      { id: "i3", label: "Child Benefit",  amount: 145,  recurring: true },
    ],
    bills: [
      { id: "b1",  label: "Mortgage",               amount: 1180, category: "Housing",   due: 1,  recurring: true },
      { id: "b2",  label: "Council Tax",            amount: 198,  category: "Housing",   due: 5,  recurring: true },
      { id: "b3",  label: "Energy (gas & electric)",amount: 172,  category: "Utilities", due: 15, recurring: true },
      { id: "b4",  label: "Water",                  amount: 41,   category: "Utilities", due: 20, recurring: true },
      { id: "b5",  label: "Broadband",              amount: 39,   category: "Utilities", due: 18, recurring: true },
      { id: "b6",  label: "Mobile phones",          amount: 44,   category: "Utilities", due: 12, recurring: true },
      { id: "b7",  label: "Nursery — Mabel",        amount: 640,  category: "Childcare", due: 1,  recurring: true },
      { id: "b8",  label: "Car finance",            amount: 215,  category: "Transport", due: 20, recurring: true },
      { id: "b9",  label: "Home Insurance",         amount: 42,   category: "Insurance", due: 8,  recurring: true },
      { id: "b10", label: "Car Insurance",          amount: 67,   category: "Insurance", due: 8,  recurring: true },
      { id: "b11", label: "Life Insurance",         amount: 38,   category: "Insurance", due: 8,  recurring: true },
    ],
  };

  // ── Past months (read-only). Clone recurring items with tweaks ──
  const clone = (arr) => arr.map((x) => ({ ...x }));

  // April — slightly smaller energy bill, larger surplus
  const april = {
    income: clone(may.income),
    bills: clone(may.bills).filter((b) => b.id !== "b3").concat([
      { id: "b3", label: "Energy (gas & electric)", amount: 158, category: "Utilities", due: 15, recurring: true },
    ]),
  };

  // March — lower second salary, tighter surplus
  const march = {
    income: clone(may.income).map((i) => (i.id === "i2" ? { ...i, amount: 1790 } : { ...i })),
    bills: clone(may.bills),
  };

  const MONTHS = {
    "2026-03": { id: "2026-03", label: "March 2026",    short: "Mar", data: march },
    "2026-04": { id: "2026-04", label: "April 2026",    short: "Apr", data: april },
    "2026-05": { id: "2026-05", label: "May 2026",      short: "May", data: may },
  };
  const MONTHS_ORDER = ["2026-03", "2026-04", "2026-05"];
  const ACTIVE = "2026-05";

  // Amendments seeded for May (newest first) — a general activity log
  const AMENDMENTS = [
    { id: uid("a"), source: "user", kind: "update", target: "Account", label: "Joint savings", from: 8600, to: 8900, reason: "Checked banking app", ts: "25 May · 08:30" },
    { id: uid("a"), source: "user", kind: "update", target: "Bill",  label: "Energy (gas & electric)", from: 158, to: 172, reason: "New fixed-rate tariff", ts: "24 May · 20:45" },
    { id: uid("a"), source: "user", kind: "create", target: "Month", label: "May 2026 created", reason: "Carried forward 14 recurring items from April", ts: "24 May · 20:40" },
  ];

  // ── Calculation ────────────────────────────────────────────────
  function compute(d) {
    const total_income = d.income.reduce((s, x) => s + (+x.amount || 0), 0);
    const total_bills  = d.bills.reduce((s, x) => s + (+x.amount || 0), 0);
    const surplus      = total_income - total_bills;
    return { total_income, total_bills, surplus };
  }

  // surplus status: <0 red (bills exceed income) · ≥0 green (left after bills)
  function surplusStatus(surplus) {
    if (surplus < -0.001) return { tone: "red",   label: "Bills exceed income" };
    return { tone: "green", label: "Surplus" };
  }

  // ── Account balance freshness ──────────────────────────────────
  const DAY = 86400000;
  function daysAgo(iso) {
    const a = new Date(iso + "T00:00:00");
    const b = new Date(TODAY + "T00:00:00");
    return Math.max(0, Math.round((b - a) / DAY));
  }
  function fmtAsOf(iso) {
    const d = daysAgo(iso);
    if (d <= 0) return "Updated today";
    if (d === 1) return "Updated yesterday";
    return `Updated ${d} days ago`;
  }
  // 30+ days since last update → stale (subtle amber treatment)
  function accountStale(iso) { return daysAgo(iso) >= 30; }
  function accountsTotal(accs) { return accs.reduce((s, a) => s + (+a.balance || 0), 0); }
  function staleCount(accs) { return accs.filter((a) => accountStale(a.asOf)).length; }

  // £ formatting — whole pounds, thousands separators, leading minus
  function gbp(n, opts) {
    opts = opts || {};
    const neg = n < 0;
    const abs = Math.abs(Math.round(n));
    const s = abs.toLocaleString("en-GB");
    const sign = neg ? "−" : (opts.plus ? "+" : "");
    return sign + "£" + s;
  }

  window.BUDGET = {
    uid, CATEGORIES, MONTHS, MONTHS_ORDER, ACTIVE, AMENDMENTS, ACCOUNTS, TODAY,
    compute, surplusStatus, gbp,
    daysAgo, fmtAsOf, accountStale, accountsTotal, staleCount,
  };
})();
