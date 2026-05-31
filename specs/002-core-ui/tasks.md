---

description: "Task list for Phase 2 — Core UI"
---

# Tasks: Phase 2 — Core UI

**Input**: Design documents from `/specs/002-core-ui/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (all present)
**Branch**: developed on `claude/budget-planner-spec-phase-2-hChzu`

**Tests**: INCLUDED — the constitution makes spec-first/test-first NON-NEGOTIABLE (Gherkin →
failing tests → minimum code). Test tasks precede the implementation they cover.

**Organization**: Tasks grouped by user story (US1–US6) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US6 (user-story phases only)
- All paths are repo-relative; the frontend lives under `frontend/`.

## Conventions

- After every component/logic slice: write the failing test first, then the minimum code.
- After every successful write the screen calls the relevant hook's `refetch()` — figures always
  come fresh from the API (constitution V / FR-009).
- API field names are kept verbatim (`is_recurring`, `due_date`, `as_of_date`, `account_type`).
- No inline styles — every component has a sibling `*.module.css`; tokens live in `styles/tokens.css`.
- Money renders `£X,XXX.XX`, negatives red with a leading minus; timestamps in local time.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the Vite + React + TypeScript app and the test/mutation toolchain.

- [ ] T001 Scaffold a Vite React+TypeScript app in `frontend/` (creates `package.json`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `eslint.config.js`, `vite.config.ts`)
- [ ] T002 Install the user-confirmed dev dependencies in `frontend/package.json`: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `@stryker-mutator/core`, `@stryker-mutator/vitest-runner` (depends on T001)
- [ ] T003 [P] Configure `frontend/vite.config.ts`: dev `server.proxy` `/api` → `http://localhost:8000`, and Vitest (`environment: jsdom`, `globals: true`, `setupFiles: src/test/setup.ts`)
- [ ] T004 [P] Create `frontend/src/test/setup.ts` importing `@testing-library/jest-dom`
- [ ] T005 [P] Create `frontend/stryker.conf.json` (vitest runner; `mutate: ["src/lib/**/*.ts"]`)
- [ ] T006 [P] Add npm scripts to `frontend/package.json`: `dev`, `build`, `lint`, `test` (vitest run), `test:mutation` (stryker run)
- [ ] T007 [P] Create `frontend/src/styles/tokens.css` from `docs/mockup/app/app.css` (CSS custom properties: navy ramp, neutrals, semantic tones, claude, radii, fonts; `.num`, scroll, `.bp-press` base) and import it in `frontend/src/main.tsx`
- [ ] T008 [P] Tighten `frontend/tsconfig.json` to strict (`strict: true`, `noUnusedLocals`, `noUnusedParameters`) — no `any`

**Checkpoint**: `npm run dev` serves a blank app proxying `/api`; `npm run test` runs (no tests yet).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API client, shared logic (`lib/`, mutation-tested), data hooks, shared components, and
the app shell — everything every story depends on.

**⚠️ CRITICAL**: No user-story screen can be completed until this phase is done.

### API layer

- [ ] T009 [P] Define API TypeScript types in `frontend/src/api/types.ts` mirroring `backend/schemas.py` (income/bills/accounts/months/summary/detail/carry-forward/amendments + create/update payloads) per `data-model.md`
- [ ] T010 Implement the fetch wrapper + `ApiError` (status + message from FastAPI `detail`; 204→void; base URL from `import.meta.env.VITE_API_BASE_URL` default `/api`) in `frontend/src/api/client.ts` (depends on T009)
- [ ] T011 [P] Implement months client (`listMonths`, `createMonth`, `carryForwardPreview`, `getMonth`, `updateMonth`, `deleteMonth`, `monthSummary`, `monthDetail`) in `frontend/src/api/months.ts` (depends on T010)
- [ ] T012 [P] Implement income client (list/create/update/delete) in `frontend/src/api/income.ts` (depends on T010)
- [ ] T013 [P] Implement bills client (list/create/update/delete) in `frontend/src/api/bills.ts` (depends on T010)
- [ ] T014 [P] Implement accounts client (list/create/update/delete) in `frontend/src/api/accounts.ts` (depends on T010)
- [ ] T015 [P] Implement amendments client (`listAmendments`) in `frontend/src/api/amendments.ts` (depends on T010)

### Shared logic (`lib/`) — tests first (mutation targets)

- [ ] T016 [P] Failing unit tests for currency/date formatting (`£X,XXX.XX`, leading minus, local timestamp, "Updated N days ago") in `frontend/src/lib/__tests__/format.test.ts`
- [ ] T017 [P] Implement `frontend/src/lib/format.ts` to pass T016
- [ ] T018 [P] Failing unit tests for `daysAgo`, `isStale` (≥30), `nextMonthString` in `frontend/src/lib/__tests__/dates.test.ts`
- [ ] T019 [P] Implement `frontend/src/lib/dates.ts` to pass T018
- [ ] T020 [P] Failing unit tests for amendment mapping (verb from `field_changed`, money value parsing, from→to) in `frontend/src/lib/__tests__/amendments.test.ts`
- [ ] T021 [P] Implement `frontend/src/lib/amendments.ts` to pass T020
- [ ] T022 [P] Failing unit tests for projected-surplus (sum included income − bills, excludes unticked) in `frontend/src/lib/__tests__/projected.test.ts`
- [ ] T023 [P] Implement `frontend/src/lib/projected.ts` to pass T022
- [ ] T024 [P] Implement suggested categories + colour dots in `frontend/src/lib/categories.ts`

### Data hooks (fetch + `refetch`)

- [ ] T025 [P] `useMonths` (list + derive editable=latest `month`, `isReadOnly(id)`) in `frontend/src/hooks/useMonths.ts` (depends on T011)
- [ ] T026 [P] `useMonthDetail(monthId)` (`{ data, loading, error, refetch }`) in `frontend/src/hooks/useMonthDetail.ts` (depends on T011)
- [ ] T027 [P] `useAccounts` (accounts + totals + refetch) in `frontend/src/hooks/useAccounts.ts` (depends on T014)
- [ ] T028 [P] `useAmendments(monthId)` in `frontend/src/hooks/useAmendments.ts` (depends on T015)

### Shared components (from `docs/mockup/`, CSS Modules)

- [ ] T029 [P] `Icon` + icon set in `frontend/src/components/Icon.tsx`
- [ ] T030 [P] `Money` (uses `format.gbp`, red on negative) in `frontend/src/components/Money.tsx` + `Money.module.css` (depends on T017)
- [ ] T031 [P] Layout primitives `Card`, `SectionLabel`, `Row`, `Banner`, `StatusPill`, `Button` (each + `.module.css`) in `frontend/src/components/`
- [ ] T032 [P] Form primitives `Sheet`, `Field`, `TextInput`, `MoneyInput`, `Toggle` (each + `.module.css`) in `frontend/src/components/`
- [ ] T033 [P] `SurplusBar` (bills-of-income, over-budget red) in `frontend/src/components/SurplusBar.tsx` + `.module.css`
- [ ] T034 [P] Chrome `NavHeader` + `TabBar` (Dashboard·Bills·Accounts·Claude, Claude badge slot) in `frontend/src/components/` + modules (depends on T029)

### App shell

- [ ] T035 Implement the app shell in `frontend/src/App.tsx`: screen-state routing, `activeMonthId`/`editableMonthId` via `useMonths`, `readOnly` flag, `TabBar` mount, bottom-sheet host, and a screen registry with placeholders for each screen (depends on T025, T034)

**Checkpoint**: app shell renders, tab bar switches between placeholder screens, `lib/` tests pass.

---

## Phase 3: User Story 1 - See the budget at a glance (Priority: P1) 🎯 MVP

**Goal**: A working dashboard (hero surplus + status pill + bills-of-income bar, receipt card,
accounts-total card with stale count, Ask-Claude placeholder card, Manage list), the empty state,
and tab-bar navigation.

**Independent Test**: With a seeded month + accounts, open the app — the dashboard shows correct
income/bills/surplus and accounts total; a negative surplus shows red; with no months the empty
state prompts month creation.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [ ] T036 [P] [US1] Dashboard tests (hero surplus + status pill, receipt figures consistent, negative surplus red + hero negative treatment, accounts card total + stale count, Manage links, read-only banner on past month, refetch on return) in `frontend/src/screens/__tests__/Dashboard.test.tsx`
- [ ] T037 [P] [US1] Empty-state test (no months → create-first-month CTA, no figures/errors) in `frontend/src/screens/__tests__/EmptyState.test.tsx`

### Implementation for User Story 1

- [ ] T038 [P] [US1] Implement `frontend/src/screens/EmptyState.tsx` (+ module) — create-first-month CTA
- [ ] T039 [P] [US1] Implement `frontend/src/screens/Claude.tsx` (+ module) — inert "Coming in Phase 3" placeholder (tab + Ask-Claude card target)
- [ ] T040 [US1] Implement `frontend/src/screens/Dashboard.tsx` (+ module): navy hero with `MonthSwitcher`, surplus `Money`, `StatusPill`, `SurplusBar`; `ReceiptCard` (income − bills = surplus); accounts-total `Card` with stale count; "Ask Claude" card → Claude; Manage list (Income, Amendments, Months) (depends on T026, T027, T030, T031, T033)
- [ ] T041 [US1] Wire Dashboard/EmptyState/Claude into the App-shell registry; gate to EmptyState when `useMonths` is empty; show read-only banner when `readOnly` (depends on T035, T040)

**Checkpoint**: Dashboard + empty state + tab navigation function against the live API (MVP).

---

## Phase 4: User Story 2 - Manage income entries (Priority: P1)

**Goal**: Income screen with add/edit/delete via a bottom sheet, recurring flag, live totals.

**Independent Test**: On the income screen, add a £500 entry — it appears and total income rises by
£500; edit and delete update totals each time; a negative amount is rejected.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [ ] T042 [P] [US2] Income tests (add via sheet appears + totals/surplus refetch, recurring flag shown, edit updates + amendment, delete updates, third entry totals immediately, negative rejected with message, read-only hides controls) in `frontend/src/screens/__tests__/Income.test.tsx`

### Implementation for User Story 2

- [ ] T043 [US2] Implement `frontend/src/components/ItemSheet.tsx` (+ module) — income mode (label, amount via `MoneyInput`, recurring `Toggle`, delete when editing, client validation) (depends on T032)
- [ ] T044 [US2] Implement `frontend/src/screens/Income.tsx` (+ module): total-income card, entry list with recurring icon, add button + row→sheet, read-only handling (depends on T026, T043)
- [ ] T045 [US2] Wire create/update/delete income through `api/income` + `useMonthDetail.refetch`; surface 422/404 inline (depends on T012, T044)

**Checkpoint**: Income management works end-to-end and refetches figures.

---

## Phase 5: User Story 3 - Manage bills grouped by category (Priority: P1)

**Goal**: Bills screen grouped by category with subtotals, due-date sort/labels, over-budget
warning, and add/edit/delete via the sheet (category chips + free-text, optional due day).

**Independent Test**: Add bills in two categories — grouped with correct subtotals; push bills above
income → over-budget banner + negative surplus; a due day outside 1–31 is rejected.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [ ] T046 [P] [US3] Bills tests (grouping + per-category subtotals, over-budget banner when bills>income, due label + due-sort within category, category chips + free-text, add/edit/delete + refetch, negative/ due-out-of-range rejected, read-only) in `frontend/src/screens/__tests__/Bills.test.tsx`

### Implementation for User Story 3

- [ ] T047 [US3] Extend `frontend/src/components/ItemSheet.tsx` with bill mode (category quick-pick chips from `lib/categories` + free-text input, optional due-day field, recurring toggle) (depends on T043, T024)
- [ ] T048 [US3] Implement `frontend/src/screens/Bills.tsx` (+ module): total-bills card + leaves-as-surplus, over-budget `Banner`, category groups with colour dot + subtotal, due labels, read-only handling (depends on T026, T031)
- [ ] T049 [US3] Wire create/update/delete bill through `api/bills` + `useMonthDetail.refetch`; client + server validation messaging (depends on T013, T048)

**Checkpoint**: Bills management works; over-budget warning and category grouping verified.

---

## Phase 6: User Story 4 - Track real account balances (Priority: P2)

**Goal**: Accounts screen (not month-scoped) with total, add/edit/delete via sheet (saves as-of
today), and stale indicators at ≥30 days.

**Independent Test**: Add three accounts (£2,300, £8,400, £12,000) — total £22,700; a >30-day
balance shows the Stale pill; switching months leaves accounts unchanged.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [ ] T050 [P] [US4] Accounts tests (add via sheet + total refetch, three-account total £22,700, edit moves as-of to today + amendment, delete updates total, ≥30-day amber dot + "Stale" pill + count, not month-scoped, empty state) in `frontend/src/screens/__tests__/Accounts.test.tsx`

### Implementation for User Story 4

- [ ] T051 [US4] Extend `frontend/src/components/ItemSheet.tsx` with account mode (label, balance; "records as of today" note; delete when editing) (depends on T043)
- [ ] T052 [US4] Implement `frontend/src/screens/Accounts.tsx` (+ module): navy header total, per-account freshness dot + "Updated N days ago" + "Stale" pill (via `lib/dates`+`lib/format`), header/banner stale count, empty state (depends on T027, T031)
- [ ] T053 [US4] Wire create/update/delete account through `api/accounts` (pass `active_month_id = editableMonthId`) + `useAccounts.refetch` (depends on T014, T052)

**Checkpoint**: Accounts management works; staleness and totals verified.

---

## Phase 7: User Story 5 - Create and switch months with carry-forward (Priority: P2)

**Goal**: Months list (switch, current badge/lock), create-month carry-forward flow (recurring-only,
editable/excludable rows, live projected surplus, skip→blank, duplicate→error), and read-only
enforcement for past months across all screens.

**Independent Test**: With a previous month of recurring + non-recurring items, start a new month —
only recurring offered with last month's amounts; override one, confirm → new month reflects it,
previous unchanged; skip → blank; duplicate period → error.

### Tests for User Story 5 ⚠️ (write first, must fail)

- [ ] T054 [P] [US5] MonthManagement tests (months list + mini figures, switch sets active month, current badge vs lock, carry-forward shows recurring only with prior amounts, amend/exclude rows, projected surplus updates, skip→blank, duplicate→409 message, previous month read-only with no edit controls + banner, return→editable) in `frontend/src/screens/__tests__/MonthManagement.test.tsx`

### Implementation for User Story 5

- [ ] T055 [US5] Implement Months list in `frontend/src/screens/MonthManagement.tsx` (+ module): months list with income/surplus minis, "Current" badge on editable/latest + lock on others, tap→switch→Dashboard (depends on T025, T026)
- [ ] T056 [US5] Implement the Create-month flow in `MonthManagement.tsx`: `carryForwardPreview`, editable carry rows with exclude toggles, live `projected` surplus, confirm→`createMonth({carry_forward, overrides})`, skip→blank month (depends on T011, T023)
- [ ] T057 [US5] Integrate the `MonthSwitcher` in the Dashboard hero and enforce read-only across Income/Bills/Accounts/Dashboard when `activeMonthId !== editableMonthId` (depends on T035, T040)
- [ ] T058 [US5] Wire MonthManagement into the App shell + handle `409` duplicate-month inline (depends on T035, T056)

**Checkpoint**: month creation, carry-forward, switching, and read-only past months all work.

---

## Phase 8: User Story 6 - Review the amendments log (Priority: P3)

**Goal**: Amendments screen showing the viewed month's change history (source, verb, from→to,
reason, local timestamp).

**Independent Test**: After editing a bill amount, open the log — one "Updated" entry with source
"You", old→new values, and a local-time timestamp.

### Tests for User Story 6 ⚠️ (write first, must fail)

- [ ] T059 [P] [US6] Amendments tests (chronological newest-first, source chip You/Claude, verb Created/Updated/Removed, from→to for updates, reason quote, local timestamp, created/deleted labels) in `frontend/src/screens/__tests__/Amendments.test.tsx`

### Implementation for User Story 6

- [ ] T060 [US6] Implement `frontend/src/screens/Amendments.tsx` (+ module) using `lib/amendments` mapping + `Money`/`Card` (depends on T028, T021)
- [ ] T061 [US6] Wire Amendments into the App shell from the Dashboard Manage list (depends on T035, T060)

**Checkpoint**: amendments log renders correctly for the viewed month.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, fidelity, and handoff.

- [ ] T062 [P] Add focused component tests for `Money` (negative red + minus, pence) and `SurplusBar` (proportions, over-budget red) in `frontend/src/components/__tests__/`
- [ ] T063 Run `npm run lint` and `npx tsc --noEmit` in `frontend/`; fix all errors/warnings (no `any`, no inline styles)
- [ ] T064 Run `npm run test`; ensure all Phase 2 Gherkin scenarios (Dashboard, Income, Bills, Account Balances, UI-facing Month Management) pass (SC-001)
- [ ] T065 Run `npm run test:mutation` (StrykerJS over `src/lib/*`); fix or record surviving mutants in repo-root `MUTANTS.md`
- [ ] T066 [P] Mobile-first pass in a **laptop browser at a phone-sized viewport** (DevTools responsive/device mode, e.g. 390×844): verify no horizontal scroll at portrait widths and adequate touch-target sizing across screens — no physical phone / Tailscale needed (deferred post-MVP)
- [ ] T067 [P] Side-by-side visual review of every screen against `docs/mockup/` (SC-006); reconcile layout/spacing/tones
- [ ] T068 Run the `specs/002-core-ui/quickstart.md` smoke checklist end-to-end against the live backend
- [ ] T069 Update `docs/progress-log.md` (Phase 2 ✅, files/functions, and the deferred `account_type`-selector divergence from research.md §8)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: depends on Setup — BLOCKS all user stories.
- **User stories (P3–P8)**: all depend on Foundational. US1 is the MVP. US2/US3/US4 reuse the
  shared `ItemSheet` introduced in US2 (T043) — US3 (T047) and US4 (T051) extend it, so they
  depend on T043; each remains independently *testable* for its own entity.
- **Polish (P9)**: depends on all targeted stories.

### User-story dependencies

- **US1 (P1)**: after Foundational. No story dependencies.
- **US2 (P1)**: after Foundational. Introduces `ItemSheet`.
- **US3 (P1)**: after Foundational; T047 extends US2's `ItemSheet` (T043).
- **US4 (P2)**: after Foundational; T051 extends US2's `ItemSheet` (T043).
- **US5 (P2)**: after Foundational; T057 read-only enforcement touches US1–US4 screens (do US5 after
  the screens it gates exist, or guard with the `readOnly` prop from the start).
- **US6 (P3)**: after Foundational. Independent.

### Within each story

- Test task(s) first (must fail) → implementation → wiring → checkpoint.

### Parallel opportunities

- Setup: T003–T008 in parallel after T002.
- Foundational: T011–T015 (api modules) parallel after T010; T016–T024 (lib + tests) parallel;
  T025–T028 (hooks) parallel after their api module; T029–T034 (components) parallel.
- Across stories (if staffed): US1, US2, US6 are fully independent; US3/US4 wait on T043.

---

## Parallel Example: Foundational logic + components

```bash
# lib tests + impl (independent files):
Task: "format tests + format.ts"      # T016, T017
Task: "dates tests + dates.ts"         # T018, T019
Task: "amendments tests + amendments.ts" # T020, T021
Task: "projected tests + projected.ts" # T022, T023

# shared components (independent files):
Task: "Icon"            # T029
Task: "Money"           # T030
Task: "layout primitives" # T031
Task: "form primitives"   # T032
Task: "SurplusBar"        # T033
Task: "NavHeader + TabBar" # T034
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 (Dashboard + empty state + nav).
4. **STOP and validate**: dashboard reads real figures, empty state works, tabs navigate. Demo.

### Incremental delivery

US1 (dashboard) → US2 (income) → US3 (bills) → US4 (accounts) → US5 (months/carry-forward) →
US6 (amendments) → Polish. Each story is a shippable increment; run the quality gates
(lint + `tsc` + vitest) at every checkpoint, full mutation + smoke in Polish.

---

## Notes

- [P] = different files, no incomplete-task dependency.
- Verify each test fails before implementing (constitution I).
- Commit one logical change per task or tight group; run lint + `tsc --noEmit` + vitest before each
  commit (constitution II).
- No backend changes — if a screen seems to need data the API doesn't expose, raise it, don't add
  backend scope.
- Read-only past months expose no active edit controls; Claude stays an inert placeholder this phase.
