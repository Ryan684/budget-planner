# Phase 0 Research: Phase 2 — Core UI

All Technical Context unknowns are resolved below. No `NEEDS CLARIFICATION` markers remain.

## Decision 1 — Styling: CSS Modules + design-token stylesheet

**Decision**: Per-component CSS Modules (`*.module.css`) plus one global `src/styles/tokens.css`
that defines the mockup's design tokens as CSS custom properties (navy ramp `--navy*`, neutrals,
semantic `--green/amber/red(+ -bg/-line)`, `--claude*`, radii `--r-card/-btn/-row`, fonts). Base
rules (`.num` tabular mono, scroll behaviour, `.bp-press`) live alongside the tokens.

**Rationale**: `docs/mockup/app/app.css` already expresses every value as a CSS variable, so the
prototype's styles port almost verbatim into modules referencing `var(--…)`. Zero new dependencies,
honours the constitution's "no inline styles", and keeps mobile-first media queries local to each
component.

**Alternatives considered**: Tailwind — rejected: adds tailwindcss/postcss/autoprefixer + config,
and the prototype's inline styles would have to be re-expressed as utilities (more work, more drift
risk). Plain global CSS — rejected: no scoping, class-name collisions at this screen count.

## Decision 2 — Test stack: Vitest + React Testing Library + jsdom (+ StrykerJS)

**Decision**: Vitest (Vite-native) with React Testing Library + `@testing-library/user-event` +
`@testing-library/jest-dom` on jsdom. Tests mock the typed API client modules with `vi.mock`,
asserting on rendered output and user interactions. StrykerJS (`@stryker-mutator/core` +
`@stryker-mutator/vitest-runner`) runs mutation testing scoped to the pure-logic modules in `lib/`.

**Rationale**: Vitest shares Vite's transform/config so there's no separate build pipeline; RTL is
the standard for behaviour-focused React tests and maps cleanly onto Gherkin Given/When/Then.
Mocking the client at the module boundary keeps tests fast and deterministic without a network
layer. StrykerJS gives the frontend the same mutation gate Phase 1 has with mutmut.

**Alternatives considered**: MSW (network-level mocking) — rejected for now: extra dependency and
setup; module-boundary mocking is sufficient for component tests and the client itself is thin.
Jest — rejected: needs its own transform config alongside Vite. Deferring Stryker — rejected: would
waive a constitutional gate; the small `lib/` surface makes Stryker cheap to run.

**New npm packages (user-confirmed)**: `vitest`, `@testing-library/react`,
`@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `@stryker-mutator/core`,
`@stryker-mutator/vitest-runner`. Styling and routing add none.

## Decision 3 — Navigation & app state (no router)

**Decision**: `App.tsx` holds screen state (`useState`/`useReducer`) and switches between screens;
the bottom `TabBar` sets the active primary screen and sub-screens are pushed from the dashboard
Manage list and month switcher. No react-router.

**Rationale**: Mirrors the prototype (`app.jsx` switches screens via state, not URLs), avoids a
dependency, and suits a phone-first single-window app with no deep-linking requirement in MVP.

**Alternatives considered**: react-router — deferred: useful if shareable URLs/back-button routing
become a requirement (note for a later phase), but unnecessary now and adds surface area.

## Decision 4 — Data fetching & freshness (no React Query)

**Decision**: Thin fetch-based hooks (`useMonths`, `useMonthDetail`, `useAccounts`,
`useAmendments`) each returning `{ data, loading, error, refetch }`. Every successful create/update/
delete awaits the write then calls the relevant `refetch()`, so all displayed figures come straight
from the API.

**Rationale**: Directly satisfies constitution V ("always recomputed fresh from the API after any
write — never from stale client data") and FR-009 without a caching library or invalidation rules.

**Alternatives considered**: React Query/SWR — deferred: caching/optimistic updates are overkill at
single-household scale and would risk showing stale figures unless carefully configured. Global
store (Redux/Zustand) — rejected: state is small and screen-local.

## Decision 5 — Editable vs read-only month

**Decision**: The editable month is the one with the greatest `month` string among
`GET /api/months` (the latest). The dashboard hero opens on it; navigating to any earlier month
renders a read-only banner and disables all add/edit/delete affordances (add buttons hidden, rows
non-interactive, sheets not openable).

**Rationale**: The API has no "current month" flag; "latest" is the deterministic, data-driven
definition the prototype uses (`editableMonthId = ACTIVE`, the most recent). Matches the spec's
read-only-previous-months rule (US5, FR-007) and the constitution.

**Alternatives considered**: Calendar-current month (today's `YYYY-MM`) — rejected: a family may set
up next month early or skip a month; "latest created" is what the prototype and carry-forward model
assume.

## Decision 6 — Currency, dates, and amendment display

**Decision**: `format.gbp(n)` → `£X,XXX.XX` (two decimals, `en-GB` grouping, leading `−` for
negatives); the `Money` component colours negatives red. Timestamps render in local time via
`toLocaleString`. `format.fmtAsOf` derives "Updated today / yesterday / N days ago" from
`as_of_date`. Amendment `field_changed` maps to a verb: `created`→"Created", `deleted`→"Removed",
any other field → "Updated {field}"; stringified `old_value`/`new_value` are parsed to numbers for
money fields and shown old → new.

**Rationale**: Satisfies FR-011/SC-005 (pence, red minus, local time). The amendment fields arrive
stringified from the API (`crud._stringify`), so parsing is required for the from→to money display
the prototype shows.

**Alternatives considered**: Whole-pound display (prototype shorthand) — rejected per the spec's
confirmed decision (pence is the standard). `Intl.NumberFormat` currency style ("£1,234.00"
built-in) — acceptable, but a small custom formatter gives exact control over the leading-minus
rule and avoids locale surprises.

## Decision 7 — Categories (free-text with suggestions)

**Decision**: The bill sheet offers the six suggested categories as quick-pick chips (Housing,
Utilities, Childcare, Transport, Insurance, One-off, each with the prototype's colour dot) and also
accepts a free-text value. Bills are grouped on the Bills screen by whatever `category` string they
carry; unknown categories get a neutral dot.

**Rationale**: Matches the spec's confirmed decision and the Phase 1 free-text `category` field
(`BillCreate.category: str`), while preserving the prototype's colour-coded grouping for the common
cases.

## Decision 8 — Account type not surfaced this phase (divergence)

**Decision**: The account add/edit sheet captures label + balance only (plus the implicit
as-of-today on save), matching the prototype. `account_type` defaults to `"current"` server-side, so
`total_savings` will equal the savings subset only once a type selector is added.

**Rationale**: The prototype omits an account-type control and the Phase 2 spec (US4) does not
require one; `total_savings` is consumed by Claude forecasting (Phase 3), not by any Phase 2 screen
(the dashboard/accounts show `total_balances`). Keeping the sheet minimal stays faithful to the
mockup.

**Divergence logged**: Add a current/savings selector to the account sheet in Phase 3 (or a
late-Phase-2 follow-up) so `total_savings` is meaningful for Claude. Record in
`docs/progress-log.md` Spec Divergences.

## Decision 9 — Validation & error states

**Decision**: Client-side validation blocks submit on empty label, non-numeric/negative amount or
balance, and due day outside 1–31 (FR-010), with inline messages. Server responses are mapped by
`client.ts`: 422 → field/validation message, 404 → not-found, 409 → "month already exists"; failed
reads/writes surface a recoverable error state (retry) rather than a blank or stale screen (FR-012).

**Rationale**: Mirrors the Phase 1 server constraints (amount ≥ 0, due_date 1–31, duplicate-month
409, not-found 404) so the UI fails fast and never silently shows partial data.

## Resolved unknowns summary

| Unknown | Resolution |
|---|---|
| Styling approach | CSS Modules + `tokens.css` (no framework) |
| Test framework & mocking | Vitest + RTL + jsdom; `vi.mock` client; StrykerJS for `lib/` |
| Routing | In-app screen state, no react-router |
| Server state mgmt | Fetch hooks with `refetch()`; no React Query |
| "Current" month | Latest `month` string = editable; earlier = read-only |
| Money/date formatting | `£X,XXX.XX` pence, red minus, local-time timestamps |
| Categories | Free-text + six suggested chips |
| account_type in UI | Omitted this phase (default "current"); divergence logged |
| Error handling | Client validation + mapped 422/404/409 + recoverable states |
| New packages | Confirmed: vitest, RTL trio, jsdom, Stryker core + vitest-runner |
