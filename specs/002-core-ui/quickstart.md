# Quickstart — Phase 2 Core UI (frontend)

Mobile-first React + Vite + TypeScript frontend over the Phase 1 API. Run the backend first so the
UI has data to read.

## Prerequisites
- Node 22 / npm 10 (available), Python backend from Phase 1.
- New frontend npm packages this phase (user-confirmed): `vitest`, `@testing-library/react`,
  `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `@stryker-mutator/core`,
  `@stryker-mutator/vitest-runner`. (CSS Modules and screen-state navigation add none.)

## 1. Run the backend (terminal 1)
```bash
cd backend
pip install -e ".[dev]"
uvicorn main:app --reload --port 8000   # serves /api/* on :8000
```
Seed a month/income/bills/accounts via the API (or the UI once running) so screens show data.

## 2. Run the frontend (terminal 2)
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```
`vite.config.ts` proxies `/api` → `http://localhost:8000` (no CORS config needed). On a phone, open
`http://<dev-host-ip>:5173`. `VITE_API_BASE_URL` defaults to the relative `/api`.

## 3. Quality gates (run before every commit — constitution II)
```bash
cd frontend
npm run lint            # ESLint
npx tsc --noEmit        # type-check, no any
npm run test            # Vitest + React Testing Library (jsdom)
npm run test:mutation   # StrykerJS over src/lib/* (mutation gate)
```
Record any surviving mutants that won't be fixed in repo-root `MUTANTS.md` (id, what mutated, why).

## 4. Build (production)
```bash
cd frontend
npm run build           # → dist/ (served via static server or FastAPI StaticFiles on the Pi)
```

## Definition of done (Phase 2)
- All Phase 2 Gherkin scenarios (Dashboard, Income, Bills, Account Balances, UI-facing Month
  Management) pass as Vitest tests.
- Screens match `docs/mockup/` in layout, navigation, and component language.
- Figures re-fetch from the API after every write; money is `£X,XXX.XX`, negatives red + minus;
  previous months are read-only; Claude is a placeholder.
- ESLint + `tsc --noEmit` clean; mutation gate satisfied (or justified in `MUTANTS.md`).
- `docs/progress-log.md` updated (incl. the account_type-selector divergence from research.md §8).

## Smoke checklist (manual, on a phone viewport)
1. Empty state → create first month.
2. Add income + bills → dashboard surplus updates; over-budget banner when bills > income.
3. Add accounts → total updates; a >30-day balance shows the Stale pill.
4. Create next month via carry-forward (amend/exclude rows; projected surplus updates).
5. Switch to a previous month → read-only banner, no edit controls; switch back → editable.
6. Amendments log lists the changes with source/verb/from→to/timestamp.
7. Claude tab/card → "Coming in Phase 3" placeholder.
