# Feature Specification: Phase 5 — Polish & Hardening

**Feature Branch**: `005-polish-hardening`

**Created**: 2026-07-26

**Status**: Draft

**Input**: User description: "@docs/budget-planner-spec.md phase 5"

Phase 5 is the final MVP phase. It hardens the app for day-to-day family use on the Pi:
optional PIN access, safe read-only handling of historical months, graceful behaviour when
things go wrong (Pi/backend offline, Anthropic API down, a nightly backup that failed), and a
complete README so the whole system can be stood up on a fresh Pi. No new budgeting features —
this phase is about trust, safety, and operability.

## Clarifications

### Session 2026-07-26

- Q: When viewing a previous month, what exactly becomes read-only? → A: Income and bills are
  locked; the month's free-text notes remain editable on any month.
- Q: Which month counts as the editable "current" month? → A: The month whose `YYYY-MM` equals the
  current calendar month; both earlier months and any future-dated months are read-only for income
  and bills.
- Q: How should the frontend PIN gate verify the entered PIN? → A: The frontend posts the PIN to a
  minimal backend verify endpoint that checks it against the configured PIN; the PIN value is never
  shipped in the client bundle.
- Q: Is the backup-staleness threshold fixed or configurable? → A: Configurable via an environment
  variable (`BACKUP_STALE_HOURS`), default 36 hours.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Optional PIN protects the app (Priority: P1)

A family member opens the app on their phone. If a PIN has been configured, they are shown a
PIN entry screen before any financial data is visible, and the app unlocks once they enter the
correct four digits. If no PIN is configured (as in development), the app opens straight to the
dashboard.

**Why this priority**: The app exposes the household's full finances. A lightweight access gate
is the single most valuable hardening step for a device that may be left unlocked, and the spec
lists it first. It is independently valuable even if nothing else in Phase 5 ships.

**Independent Test**: Configure a PIN, load the app, confirm no data is visible until the
correct PIN is entered and that a wrong PIN is rejected. Then clear the PIN config and confirm
the app loads with no gate.

**Acceptance Scenarios**:

1. **Given** a PIN is configured, **When** the app is first loaded, **Then** a PIN entry screen
   is shown and no dashboard, income, bills, account, or Claude data is visible behind it.
2. **Given** the PIN entry screen is showing, **When** the correct PIN is entered, **Then** the
   app unlocks and shows the dashboard, and stays unlocked while navigating between screens.
3. **Given** the PIN entry screen is showing, **When** an incorrect PIN is entered, **Then** an
   error is shown, the app stays locked, and no data is revealed.
4. **Given** no PIN is configured, **When** the app is loaded, **Then** the dashboard is shown
   immediately with no PIN step.
5. **Given** the app is unlocked, **When** the browser session ends and the app is reopened in a
   new session, **Then** the PIN is required again.

---

### User Story 2 - Previous months are read-only everywhere (Priority: P2)

A user browses back to an earlier month to review it. Every screen makes clear that the month is
historical: there are no controls to add, edit, or delete that month's income or bills. The
current month remains fully editable, and account balances (which are not tied to a month) stay
editable regardless of which month is on screen.

**Why this priority**: Historical months are the audit record the household reasons against.
Accidentally editing a past month would silently corrupt trend analysis and Claude's
forecasting. Locking them protects data integrity. It builds on the existing current-month-only
write rule already enforced for Claude.

**Independent Test**: With at least one previous month present, open it and confirm no
add/edit/delete affordances appear for its income or bills; switch to the current month and
confirm full editing returns; confirm account editing works from either view.

**Acceptance Scenarios**:

1. **Given** a previous month is being viewed, **When** its Income and Bills screens are shown,
   **Then** no add, edit, or delete controls for those items are available.
2. **Given** a previous month is being viewed, **When** a write to that month's income or bills
   is nonetheless attempted, **Then** the backend rejects it with a clear "previous months are
   read-only" error and no data changes.
3. **Given** the current month is being viewed, **When** its Income and Bills screens are shown,
   **Then** full add/edit/delete editing is available.
4. **Given** any month (current or previous) is being viewed, **When** the Accounts screen is
   used, **Then** account balances can still be added, edited, and deleted (accounts are not
   month-scoped).

---

### User Story 3 - Graceful error states (Priority: P3)

Things fail: the Pi is off, the network drops, the Anthropic API is unavailable, or a write
doesn't land. In every case the user sees a clear, non-technical message and a way forward
(retry) rather than a blank screen, an infinite spinner, or a stack trace. A failed or overdue
nightly backup is surfaced as a warning banner on the dashboard so the operator notices before
data is at risk.

**Why this priority**: A self-hosted app on a Pi will hit these conditions in normal life.
Handling them keeps the app trustworthy and prevents silent data-loss surprises (especially a
backup that has quietly stopped running). It depends on the core screens (P1/P2) existing.

**Independent Test**: Simulate each failure — stop the backend and load a screen; force a Claude
API error; make a write fail; point the backup-status source at a FAILED/stale log — and confirm
the corresponding user-facing error or banner appears with a recovery path.

**Acceptance Scenarios**:

1. **Given** the backend is unreachable, **When** any data screen is opened, **Then** a clear
   error state with a retry option is shown within a few seconds — never an indefinite spinner or
   blank screen.
2. **Given** the Anthropic API is unavailable, **When** a Claude message is sent, **Then** the
   Claude screen shows a friendly error, preserves the conversation and the typed message, and
   allows a retry.
3. **Given** a write operation (add/edit/delete) fails, **When** the failure returns, **Then** an
   error is shown and the UI reflects the true persisted state (no stale optimistic values).
4. **Given** the most recent nightly backup FAILED, or no successful backup has occurred within
   the staleness threshold, **When** the dashboard is loaded, **Then** a warning banner is shown.
5. **Given** the most recent nightly backup succeeded within the threshold, **When** the
   dashboard is loaded, **Then** no backup warning banner is shown.
6. **Given** no backup log is available (e.g. in development), **When** the dashboard is loaded,
   **Then** no false backup-failure banner is shown.

---

### User Story 4 - Fresh-Pi setup from the README (Priority: P4)

A new operator (or the same operator rebuilding on new hardware) can take a bare Raspberry Pi 5
and, following only the README, reach a fully working deployment: app running under systemd,
data on the USB SSD, nightly backup timer active, remote access via Tailscale, and the optional
PIN configured. A documented end-to-end checklist confirms every part is live.

**Why this priority**: Documentation is what makes the system recoverable and maintainable after
the build sessions end. It is essential for MVP completeness but has no runtime behaviour, so it
lands last.

**Independent Test**: Follow the README on a fresh Pi (or a clean environment mirroring it) and
complete the end-to-end checklist with no undocumented steps required.

**Acceptance Scenarios**:

1. **Given** a fresh Pi and the README, **When** the setup guide is followed end to end, **Then**
   the backend, frontend, database on USB SSD, and backup timer are all running with no steps
   that required knowledge outside the README.
2. **Given** the completed setup, **When** the end-to-end validation checklist is run, **Then**
   each screen loads, a Claude query works, and a manually triggered backup produces a commit in
   the backup repo.
3. **Given** the README, **When** the remote-access section is followed, **Then** the app is
   reachable from a phone over Tailscale.

---

### Edge Cases

- **Unlock persistence**: reloading the page mid-session keeps the app unlocked; only ending the
  browser session re-locks it. There is no attempt lockout/throttle in the MVP.
- **No previous months yet**: when only the current calendar month exists, read-only logic never
  triggers and everything is editable.
- **Editable-month determination**: the editable month is the one whose `YYYY-MM` equals the
  current calendar month; earlier months and any future-dated months are read-only for income and
  bills.
- **Current calendar month not yet created**: if no budget month matches the current calendar
  month, no month's income/bills are editable until that month is created (typically via
  carry-forward); existing months remain read-only.
- **Future month created ahead**: a month created before its calendar month arrives is read-only
  for income and bills until that month becomes the current calendar month.
- **Malformed/partial backup log**: an unreadable or partial log is treated as "unknown" status —
  no false failure banner.
- **Backup timer stopped**: an old SUCCESS with nothing since crosses the staleness threshold and
  raises the banner.
- **Backend reachable but erroring (5xx)**: shows an error state, not a crash or blank screen.
- **Anthropic API failure mid-conversation**: the in-session conversation is preserved so the
  user can retry without retyping context.
- **Development environment**: no PIN and no backup log — the app loads straight to the dashboard
  with no gate and no banner.

## Requirements *(mandatory)*

### Functional Requirements

**PIN protection (US1)**

- **FR-001**: When a PIN is configured, the app MUST present a PIN entry screen on load and MUST
  NOT display any financial data until the correct PIN is entered.
- **FR-002**: When no PIN is configured, the app MUST load directly to the dashboard with no PIN
  step.
- **FR-003**: The app MUST unlock on a correct PIN and remain unlocked across in-app navigation
  and page reloads for the duration of the browser session; a new browser session MUST require
  the PIN again.
- **FR-004**: On an incorrect PIN the app MUST show an error, remain locked, and reveal no data.
- **FR-005**: The PIN MUST NOT be included in any data sent to Claude/the Anthropic API, nor in
  any backup export.
- **FR-005a**: The frontend MUST verify the entered PIN by calling a minimal backend endpoint that
  checks it against the configured PIN; the configured PIN value MUST NOT be embedded in the
  delivered frontend bundle. (The rest of the API remains unauthenticated — see Assumptions.)

**Previous-month read-only (US2)**

- **FR-006**: When a non-editable month is being viewed, the UI MUST NOT present add, edit, or
  delete controls for that month's income entries or bills. The month's free-text notes remain
  editable on any month.
- **FR-007**: The editable month is the one whose `YYYY-MM` equals the current calendar month;
  only it allows add/edit/delete of income and bills. Both earlier months and any future-dated
  months are read-only for income and bills.
- **FR-008**: The backend MUST reject create/update/delete of income entries and bills belonging
  to any month other than the current calendar month with a clear read-only error, as
  defence-in-depth behind the UI. Editing a month's notes is not restricted.
- **FR-009**: Account balances MUST remain editable regardless of which month is being viewed
  (accounts are not month-scoped).
- **FR-010**: Carry-forward MUST continue to work — reading a previous month to populate a new
  month is not a write to the previous month and MUST NOT be blocked by the read-only rule.

**Error states (US3)**

- **FR-011**: When the backend is unreachable, every data screen MUST show a clear, non-technical
  error state with a retry action within ~10 seconds (see SC-004), never an indefinite spinner or
  blank screen.
- **FR-012**: When the Anthropic API is unavailable, the Claude screen MUST show a friendly
  error, preserve the current conversation and the user's typed message, and allow a retry.
- **FR-013**: A failed write (add/edit/delete) MUST surface an error and MUST leave the UI showing
  the true persisted state (no stale/optimistic values left behind).
- **FR-014**: The backend MUST expose the most recent nightly-backup outcome (status and
  timestamp) derived from the Phase 4 backup log.
- **FR-015**: The dashboard MUST show a warning banner when the last backup FAILED, or when no
  successful backup has occurred within the staleness threshold (configurable via the
  `BACKUP_STALE_HOURS` environment variable, default 36 hours); it MUST show no banner when the
  last backup succeeded within the threshold.
- **FR-016**: The backup-status source MUST degrade gracefully when the log is absent or
  unreadable (report "unknown"), and in that case the dashboard MUST NOT show a failure banner.

**Documentation & end-to-end (US4)**

- **FR-017**: The README MUST provide a complete fresh-Pi setup guide covering: USB SSD mount,
  runtime prerequisites, backend and frontend systemd services, production environment config
  (including the PIN and `BACKUP_STALE_HOURS`), backup systemd timer + SSH key setup, PIN
  configuration, and Tailscale remote-access setup.
- **FR-018**: A documented end-to-end validation checklist MUST exist that an operator follows on
  a fresh Pi to confirm every screen, a Claude query, remote access, and a backup run all work
  from the README alone.

### Key Entities *(include if feature involves data)*

- **Unlock state**: whether the current browser session has passed the PIN gate (the PIN being
  checked by the backend verify endpoint, not compared in the browser). Frontend session-scoped
  only; not persisted server-side and not stored in the database.
- **Current month**: the budget month whose `YYYY-MM` equals the current calendar month; the only
  month whose income and bills are editable. Earlier months and any future-dated months are
  read-only (their notes remain editable). A derived concept, not a new stored field.
- **Backup status**: the latest backup outcome derived from the Phase 4 backup log — last result
  (`SUCCESS` / `FAILED` / `unknown`) and the timestamp of the last run, plus whether that run is
  within the staleness threshold. Read-only and derived; not stored in the app database.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a PIN configured, 100% of app loads present the PIN gate and reveal zero
  financial data until the correct PIN is entered; an incorrect PIN never reveals data.
- **SC-002**: With no PIN configured, the app reaches the dashboard in zero extra steps.
- **SC-003**: When viewing any previous month, there are zero controls capable of altering that
  month's income or bills, while the current month retains full editing and accounts stay
  editable from any view.
- **SC-004**: When the backend is unreachable, every data screen presents an actionable error
  with a retry within ~10 seconds — never an indefinite spinner or blank screen.
- **SC-005**: A failed or over-threshold-stale backup produces a visible dashboard warning on the
  next load, and a healthy recent backup produces none; a missing log produces no false warning.
- **SC-006**: A new operator can take a fresh Pi to a fully working, backed-up, remotely
  accessible deployment using only the README, with no undocumented steps, as proven by the
  end-to-end checklist.

## Assumptions

- **Frontend PIN gate, backend-verified** (clarified 2026-07-26): the PIN is enforced by the
  frontend as an access screen, but the entered PIN is verified by a minimal backend endpoint, so
  the configured PIN value is not shipped in the client bundle. The rest of the API is not
  authenticated; API access control for the MVP relies on the network boundary (home WiFi +
  Tailscale). This is a convenience lock for a self-hosted family app, not a defence against a
  determined attacker with network access; full API authentication is a post-MVP consideration.
- Unlock persists for the browser session (re-locks when the session ends); no attempt
  lockout/throttling in the MVP.
- **Backup failure surfaced in-app** (clarified 2026-07-26): the backend reads the Phase 4
  `SUCCESS`/`FAILED` backup log and exposes the latest outcome; the dashboard shows a warning
  banner on failure or staleness. The staleness threshold is configurable via the
  `BACKUP_STALE_HOURS` environment variable, default 36 hours (one missed nightly run plus margin).
- "Current month" = the month whose `YYYY-MM` equals the current calendar month; earlier and
  future-dated months are read-only for income and bills (notes stay editable). Read-only is
  enforced in both the UI and the backend (defence-in-depth); account balances are exempt as they
  are not month-scoped.
- **Single, uniform definition of "current month"** (reconciled 2026-07-26): the calendar-month
  definition applies everywhere — the editable month in the UI, the month Claude writes to, and the
  dashboard default. This **supersedes the shipped Phase 2/3 behaviour** where "current month"
  meant the *latest* month (`YYYY-MM` max), so Phase 5 changes `useMonths`, the Claude write-target
  resolution (`latest_month_id`), and the dashboard default accordingly, and records a Phase 3
  divergence. The constitution's Principle IV wording ("active current month") is reinterpreted as
  the calendar month and updated in lockstep with `CLAUDE.md` (done — Constitution v1.2.0,
  2026-07-26). **Canonical term**: use "current month" (≡ the current calendar month) throughout;
  "editable month" and "current calendar month" are synonyms for the same concept.
- The current calendar month is derived from **local time on the Pi** (the household's timezone),
  not UTC, since "this month" is a local human concept; when today's month has not been created,
  no month's income/bills are editable and Claude has no write target until it is created.
- The fresh-Pi end-to-end test (FR-018) is a **documented manual checklist executed by the
  operator on real Pi hardware**, consistent with Phase 4's Pi-only manual gates — not an
  automated CI test. It depends on Phase 4 being deployed and validated on the Pi.
- Tailscale is documented in the README but remains an infrastructure prerequisite outside the
  app's code (per project constraints).
- No new runtime dependencies are anticipated; PIN gate, error states, and backup banner are
  built on the existing FastAPI + React/Vite stack.
- The backup-status feature depends on the Phase 4 backup log format (a `SUCCESS`/`FAILED` line
  with a timestamp) being present on the Pi; in development where no log exists, status is
  "unknown" and no banner shows.
