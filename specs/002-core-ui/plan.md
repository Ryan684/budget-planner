# Implementation Plan: Phase 2 — Core UI

**Branch**: `002-core-ui` (developed on `claude/budget-planner-spec-phase-2-hChzu`) | **Date**: 2026-05-31 | **Spec**: `./spec.md`
**Input**: Feature specification from `/specs/002-core-ui/spec.md`

## Summary

Build the mobile-first React + Vite + TypeScript frontend that makes the Phase 1 data layer usable
from a phone browser, reproducing the `docs/mockup/` Claude Designer prototype. Deliver a navy app
shell with a bottom tab bar (Dashboard · Bills · Accounts · Claude), the dashboard hero +
receipt-style summary, Income/Bills/Accounts management via bottom sheets, month
creation/carry-forward + switching with read-only past months, and the amendments log. All figures
are read fresh from the existing `/api/*` endpoints and re-fetched after every write. Claude is a
placeholder (Phase 3). Tests-first with Vitest + React Testing Library, then StrykerJS mutation
testing; ESLint + `tsc --noEmit` clean. No backend changes.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, no `any`), React 18, Node 22 / npm 10

**Primary Dependencies**: React + Vite (scaffold); test stack Vitest + @testing-library/react +
@testing-library/user-event + @testing-library/jest-dom + jsdom; mutation StrykerJS
(@stryker-mutator/core + @stryker-mutator/vitest-runner). Styling: CSS Modules + one global
design-token stylesheet (no CSS framework). Routing/data: in-app screen state + fetch-based hooks
(no react-router, no React Query, no MSW) — keeps the dependency surface minimal and matches the
prototype's state-driven navigation.

**Storage**: None client-side beyond ephemeral React state; the SQLite data layer is reached only
through the Phase 1 REST API.

**Testing**: Vitest + React Testing Library (jsdom); API client mocked at the module boundary with
`vi.mock`. StrykerJS for mutation testing of pure logic (formatting, date/stale, projected-surplus,
amendment mapping). ESLint (Vite config) + `npx tsc --noEmit`.

**Target Platform**: Mobile browser (portrait phone first), served on the home network / Tailscale;
dev on `http://localhost:5173` with Vite proxying `/api` → `http://localhost:8000`.

**Project Type**: web — frontend slice this phase (backend delivered in Phase 1).

**Performance Goals**: Surplus readable within ~5s of load on a phone; no horizontal scroll in
portrait. Single-household scale (2 users, dozens of rows/month) — correctness over throughput.

**Constraints**: No `any`; no inline styles (CSS Modules only); money as `£X,XXX.XX` with negatives
red + leading minus (never parentheses); timestamps shown in local time; figures always re-fetched
from the API after a write (never recomputed from stale client state). New npm packages confirmed
with the user before install.

**Scale/Scope**: ~9 screens/views, ~15 shared components, 5 API resource clients, ~12 functional
requirements, 6 user stories.

## Constitution Check

*GATE: passes — no violations. Re-checked after Phase 1 design — still passes.*

| Principle | Compliance |
|---|---|
| I. Spec-first, test-first | Gherkin exists (Dashboard, Income, Bills, Account Balances, Month Mgmt); failing Vitest tests precede each component/logic slice ✅ |
| II. Quality gates | ESLint + `tsc --noEmit` + Vitest + StrykerJS; surviving mutants → `MUTANTS.md` ✅ |
| III. Typed, schema-driven, no inline styles | TS strict no-`any`; API types mirror Pydantic schemas; CSS Modules + tokens; mobile-first; `£X,XXX.XX`, red minus ✅ |
| IV. Privacy & minimal AI context | N/A — no Claude calls this phase; tab/card are inert placeholders ✅ |
| V. Data durability & integrity | Re-fetch fresh after every write; no stale client calc (the only client computation is the pre-creation projected-surplus preview, which writes nothing) ✅ |

No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/002-core-ui/
├── spec.md              # WHAT/WHY
├── plan.md              # this file
├── research.md          # Phase 0 — decisions & rationale
├── data-model.md        # Phase 1 — TS types & view models (mirror Phase 1 API)
├── quickstart.md        # Phase 1 — run/dev/test instructions
├── contracts/
│   ├── api-client.md    # typed client surface consumed from the Phase 1 API
│   └── screens.md       # screen/navigation + read-only contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts                # /api proxy → :8000; vitest config (jsdom, setup file)
├── stryker.conf.json             # mutation testing (vitest runner)
├── eslint.config.js              # from Vite scaffold
├── src/
│   ├── main.tsx                  # app entry, mounts <App/>
│   ├── App.tsx                   # shell: screen state, active/editable month, tab bar, sheet host
│   ├── api/
│   │   ├── client.ts             # fetch wrapper, base URL, JSON, ApiError mapping
│   │   ├── types.ts              # TS types mirroring backend Pydantic schemas
│   │   ├── months.ts             # list/create/get/summary/detail/carry-forward-preview
│   │   ├── income.ts             # list/create/update/delete
│   │   ├── bills.ts              # list/create/update/delete
│   │   ├── accounts.ts           # list/create/update/delete
│   │   └── amendments.ts         # list by month
│   ├── hooks/
│   │   ├── useMonths.ts          # months list + derived current/editable month
│   │   ├── useMonthDetail.ts     # month detail (income+bills+summary) + refetch
│   │   ├── useAccounts.ts        # accounts + totals + refetch
│   │   └── useAmendments.ts      # amendments for a month + refetch
│   ├── lib/
│   │   ├── format.ts             # gbp(), local timestamp, "Updated N days ago"
│   │   ├── dates.ts              # daysAgo, isStale(>=30), nextMonthString
│   │   ├── projected.ts          # pure projected-surplus for carry-forward preview
│   │   ├── amendments.ts         # field_changed → verb/label + value parsing
│   │   └── categories.ts         # suggested categories + colour dots
│   ├── components/               # Money, Card, SectionLabel, SurplusBar, StatusPill,
│   │                             #   Row, Button, Banner, Sheet, Field, TextInput,
│   │                             #   MoneyInput, Toggle, Icon, NavHeader, TabBar (+ .module.css)
│   ├── screens/
│   │   ├── Dashboard.tsx
│   │   ├── Income.tsx
│   │   ├── Bills.tsx
│   │   ├── Accounts.tsx
│   │   ├── Amendments.tsx
│   │   ├── MonthManagement.tsx   # months list + create/carry-forward flow
│   │   ├── Claude.tsx            # "Coming in Phase 3" placeholder
│   │   └── EmptyState.tsx
│   ├── styles/
│   │   └── tokens.css            # mockup design tokens as CSS custom properties + base
│   └── test/
│       └── setup.ts              # jest-dom matchers; test bootstrap
└── src/**/__tests__/*.test.tsx   # Vitest + RTL, one per screen/lib (Gherkin-mapped)
```

Repo root `MUTANTS.md` is shared (already exists). `.gitignore` already covers `node_modules/`,
`dist/`, `.env*`.

**Structure Decision**: Web app, frontend slice. Follows the CLAUDE.md frontend layout
(`screens/`, `api/`, `components/`, `main.tsx`) and extends it with `hooks/`, `lib/`, `styles/`,
and `test/`. Screen names match CLAUDE.md; `MonthManagement.tsx` hosts both the months list and the
create/carry-forward flow.

## Key Design Decisions (ratified — see research.md)

- **Styling**: CSS Modules per component + one global `tokens.css` holding the mockup's CSS custom
  properties (navy ramp, semantic tones, radii, IBM Plex fonts). The prototype is already built on
  these exact variables, so it ports almost 1:1 with no framework. No inline styles (constitution).
- **Test stack**: Vitest + React Testing Library + jsdom; the typed API client is mocked at the
  module boundary with `vi.mock` (no MSW). StrykerJS (vitest runner) covers the pure-logic modules
  in `lib/` so the mutation gate has frontend parity with Phase 1.
- **Navigation/state**: in-app screen state in `App.tsx` (mirrors the prototype's reducer-driven
  screen switching) — no react-router. The **editable** month is the one with the greatest `month`
  string (latest); any earlier month renders read-only with a banner and no active edit controls.
- **Data flow**: fetch-based hooks expose `{ data, loading, error, refetch }`; every successful
  write calls `refetch()` so figures come fresh from the API (constitution V). No React Query.
- **Field-name mapping**: the API uses `is_recurring` / `due_date` / `as_of_date` / `account_type`;
  the UI keeps API names in types and maps to the prototype's display in components — no renaming of
  the contract.
- **Single-call dashboard**: `GET /api/months/{id}/detail` returns month + income + bills + summary
  in one request; accounts come from `GET /api/accounts` (with `total_balances`/`total_savings`).
- **Staleness** is computed client-side from `as_of_date` (≥30 days → stale); the API has no stale
  flag. Account `account_type` defaults to `"current"` server-side and is **not** surfaced in the
  Phase 2 add/edit sheet (the prototype omits it; the savings distinction matters for Claude
  forecasting in Phase 3) — recorded as a divergence in research.md.
- **Validation**: client blocks negative amounts/balances and due day outside 1–31 before submit
  (FR-010) and also surfaces server 422/404/409 as recoverable inline errors.
- **Claude**: tab + dashboard "Ask Claude" card are present but route to a placeholder; no API call.

## Complexity Tracking

None — design stays within constitutional constraints (no new architectural patterns, minimal
dependency surface, no backend changes).
