# Feature Specification: Backup Automation

**Feature Branch**: `004-backup-automation`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: "@docs/budget-planner-spec.md phase 4"

## Clarifications

### Session 2026-06-24

- Q: Should the system automatically rebuild the DB from the JSON export, or is JSON a manual fallback only? → A: Manual human-readable fallback only; automated JSON→DB import is out of scope.
- Q: Should each run verify the backup is valid before counting as successful? → A: Yes — run a SQLite integrity check on the copied DB and confirm the JSON parses; fail the run if either is bad (do not commit a corrupt backup).
- Q: Where should the per-run success/failure log live? → A: A local log file on the Pi (captures failures even when the push fails; independent of the repo).
- Q: What happens if the Pi is powered off at the scheduled backup time? → A: Catch up on the next boot (anacron-style scheduling), so an overnight power-off does not silently skip a backup.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unattended nightly offsite backup (Priority: P1)

As the household, I want my budget database copied to a private offsite location
automatically every night without me doing anything, so that if the Raspberry Pi or its
SSD dies I have not lost our financial records.

**Why this priority**: This is the entire point of the phase. Without the automated nightly
push there is no offsite copy, and a single hardware failure loses everything. Every other
story in this phase exists to make this one trustworthy.

**Independent Test**: Trigger the backup routine once on the Pi and confirm that a new commit
appears in the private backup repository on GitHub containing an up-to-date copy of the
database and the JSON export — with no manual steps beyond the initial trigger.

**Acceptance Scenarios**:

1. **Given** the backup routine has been set up on the Pi with repository access configured,
   **When** the nightly schedule fires, **Then** the current database file and a freshly
   generated JSON export are committed and pushed to the private backup repository.
2. **Given** a successful run last night, **When** the routine runs again tonight with changed
   budget data, **Then** a new commit is pushed reflecting the latest data, and the database is
   stored under the same stable filename (the previous version remains recoverable from history).
3. **Given** the budget data is unchanged since the last run, **When** the routine runs,
   **Then** it completes cleanly without creating an empty/erroneous commit or reporting failure.

---

### User Story 2 - Reliable recovery from backup (Priority: P1)

As the household, I want a documented, tested procedure to restore the app from the backup,
so that after a failure I can get back to a working state with confidence and without guesswork.

**Why this priority**: A backup that has never been restored is not a backup. Recovery is what
gives the nightly push its value, so it shares top priority. The JSON export must also stand
alone as a human-readable fallback if the database file itself is corrupt.

**Independent Test**: From a clean machine, follow the written recovery procedure using only the
contents of the backup repository, and confirm the app runs with the restored data intact.

**Acceptance Scenarios**:

1. **Given** a populated backup repository, **When** an operator follows the recovery procedure
   (clone repo, restore database file, restart app), **Then** the app starts and shows the same
   months, income, bills, accounts, and balances as before the failure.
2. **Given** the database file is corrupt or unreadable, **When** an operator inspects the JSON
   export from the same backup, **Then** every month's income, bills, and surplus and all account
   balances with their snapshot history are present and human-readable as a manual fallback.
3. **Given** the recovery procedure document, **When** it is followed step by step on a clean
   machine, **Then** no undocumented step is required to reach a working restored app.

---

### User Story 3 - Visibility into backup health (Priority: P2)

As the household, I want each backup run to record whether it succeeded or failed and why, so
that a silently broken backup does not go unnoticed for weeks.

**Why this priority**: Important for trust, but the core protection (P1) works without it. Active
alerting (push/email on failure) is explicitly a Phase 5 hardening concern; this phase only needs
a durable local record that a person or a later phase can inspect.

**Independent Test**: Run the routine once so it succeeds and once under a forced failure (e.g.
no network), and confirm each outcome is recorded with a timestamp and an indication of success
or the failure reason.

**Acceptance Scenarios**:

1. **Given** a backup run completes successfully, **When** it finishes, **Then** a log entry is
   written recording the timestamp and success.
2. **Given** a backup run fails (e.g. the push is rejected or the network is unavailable),
   **When** it exits, **Then** it records the failure with a timestamp and a reason, and exits
   with a non-zero status so the scheduler/log reflects the failure.

---

### Edge Cases

- **No network / GitHub unreachable**: the run must fail loudly (non-zero exit, logged reason),
  leaving the local working copy intact, and the next night's run must recover normally.
- **Push rejected (remote ahead / auth failure)**: treated as a failure and logged; no partial
  or corrupt state is left that would block the next run.
- **Database file missing or zero-length at backup time**: the run must detect this and fail
  rather than committing an empty/garbage backup over a good history.
- **Database file locked / mid-write**: the backup must capture a consistent copy of the database,
  not a torn read.
- **No budget data yet (empty database)**: a valid backup of the empty-but-well-formed database
  and a valid (empty) JSON export are produced without error.
- **First-ever run**: works against an empty backup repository with no prior commits.
- **Unchanged data since last run**: no spurious failure and no misleading commit (see US1 #3).
- **Run invoked while a previous run is still in progress**: the second invocation must not
  corrupt the backup (e.g. via a lock or guard).
- **Integrity check fails**: if the copied database fails its integrity check or the generated
  JSON does not parse, the run must fail (logged, non-zero exit) and must not commit/push the bad
  artifacts over good history.
- **Pi powered off at the scheduled time**: the missed run must execute once the Pi is back up
  (catch-up scheduling) rather than being silently skipped until the next night.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST produce a backup of the live SQLite database on a nightly schedule
  on the Raspberry Pi, without manual intervention once configured. If the scheduled time is
  missed because the Pi was powered off, the run MUST execute on the next boot (catch-up
  scheduling) rather than being skipped until the following night.
- **FR-002**: The database backup MUST be a consistent, point-in-time copy (not a torn read taken
  mid-write).
- **FR-003**: The database copy MUST be stored in the backup repository under a single stable
  filename; dated/versioned history is provided by the repository's commit history, not by
  re-timestamping the binary file each night.
- **FR-004**: The system MUST generate a full-history JSON export covering every month's income,
  bills, and surplus, plus all account balances and their snapshot history and the amendments log
  (i.e. the full `build_budget_context` payload), as a human-readable fallback independent of the
  binary database file. The JSON is a manual fallback only — automated
  reconstruction of the database from the JSON is explicitly out of scope (the binary `.db` copy is
  the restore path).
- **FR-004a**: Before committing/pushing, the system MUST verify the backup artifacts: a SQLite
  integrity check on the copied database file MUST pass and the generated JSON MUST parse. If
  either check fails, the run MUST be treated as a failure (per FR-008/FR-009) and MUST NOT commit
  or push the artifacts.
- **FR-005**: The system MUST commit and push the database copy and the JSON export to a private,
  offsite Git repository over an authenticated connection on each run.
- **FR-006**: The backup repository MUST be separate from the application source repository.
- **FR-007**: The system MUST NOT include application secrets, the `.env` files, the API key, or
  the PIN in any backup artifact.
- **FR-008**: Each run MUST record its outcome (success or failure) with a timestamp to a local
  log file on the Pi, and on failure MUST record a reason and exit with a non-zero status. The log
  is local (not solely in the backup repository) so that failures — including push failures — are
  always captured regardless of whether the push succeeded.
- **FR-009**: On any failure (no network, rejected push, missing/empty database), the system MUST
  NOT overwrite or corrupt previously good backups, and MUST leave the system able to back up
  successfully on the next scheduled run.
- **FR-010**: A run with no data changes since the previous successful run MUST complete without
  error and without producing a misleading or empty commit.
- **FR-011**: The recovery procedure MUST be documented in the project README such that an
  operator can restore a working app from the backup repository alone, following only the written
  steps.
- **FR-012**: The recovery procedure MUST be tested end-to-end on the Pi and confirmed to restore
  the data intact; the JSON export MUST be verified as a usable standalone fallback.
- **FR-013**: Setup MUST be documented: authorising the Pi against the private backup repository,
  installing the nightly schedule, and the location of the backup artifacts and run log.
- **FR-014**: The backup routine and its outputs are Pi-only and MUST NOT run as part of local
  development or the automated test suite against a developer machine.

### Key Entities *(include if feature involves data)*

- **Database backup artifact**: A consistent copy of the live SQLite database file, stored in the
  private backup repository under a stable filename. Restoring it returns the app to its last
  backed-up state.
- **JSON export artifact**: A structured, human-readable snapshot of the full financial history —
  every month (income, bills, surplus) and every account balance with its snapshot history. The
  fallback when the binary database is unreadable. Contains no secrets.
- **Backup run record (log)**: A per-run entry in a local log file on the Pi, capturing timestamp
  and outcome (success, or failure with reason). Kept locally so push failures are still recorded.
  The basis for noticing a broken backup.
- **Private backup repository**: The offsite Git repository, separate from the app source repo,
  holding the backup artifacts; its commit history is the versioned backup timeline.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After setup, a new dated commit containing the current database and a full-history
  JSON export appears in the private backup repository every night with zero manual steps.
- **SC-002**: An operator with no prior knowledge of the internals can restore a fully working app
  from the backup repository in under 30 minutes using only the written recovery procedure.
- **SC-003**: A restored app shows 100% of the months, income entries, bills, accounts, and
  account balances that existed at the time of the backup — no data loss.
- **SC-004**: With the binary database deleted, every month's figures and all account balances are
  still fully recoverable/readable from the JSON export alone.
- **SC-005**: 100% of backup runs leave a durable record of their outcome; a failed run is
  distinguishable from a successful one without inspecting the repository by hand.
- **SC-006**: No backup artifact ever contains a secret, API key, `.env` value, or PIN
  (verifiable by inspecting the backup repository contents).
- **SC-007**: A failed run never degrades the previous good backup; the immediately following
  scheduled run succeeds once the failure condition is removed.
- **SC-008**: No backup is ever committed/pushed unless its database copy passes a SQLite integrity
  check and its JSON export parses — a corrupt artifact is rejected rather than stored.

## Assumptions

- **Authenticated push over SSH**: The Pi authenticates to the private backup repository using an
  SSH key configured at Pi setup time, consistent with the project spec. Key generation/authorising
  is a documented setup step, not something the routine performs.
- **Scheduling with catch-up**: The nightly schedule runs on the Pi (per the spec and CLAUDE.md)
  using a mechanism that re-runs a missed job on the next boot (anacron-style), so an overnight
  power-off does not silently skip a backup. The exact run time is an operational detail (default:
  early morning, low-activity hours).
- **Backup repo provisioning is a setup prerequisite**: The empty private backup repository already
  exists on GitHub (created in Phase 0) and is reachable from the Pi.
- **Scope excludes active alerting**: Surfacing backup failures via push/email/UI alerts is a
  Phase 5 hardening item; this phase records outcomes durably (log + non-zero exit) but does not
  notify the user proactively.
- **Pi-only execution**: Per CLAUDE.md, the backup script is not run or tested in local development;
  its end-to-end and recovery testing happens on the Pi.
- **No new runtime dependencies assumed**: The routine is expected to use tooling already present
  on the Pi (shell, SQLite, Git) and the app's existing export capability; any genuinely new
  dependency will be confirmed before adoption.
- **Database-side consistency**: A consistent copy is obtained using SQLite's own safe-copy
  capability (e.g. a backup/online-copy mechanism) rather than a raw file copy during writes; the
  precise mechanism is an implementation decision for the plan phase.

## Dependencies

- Phase 0 infrastructure: USB SSD mounted, the private backup repository created on GitHub, and
  an SSH key on the Pi authorised against it.
- Phase 1 data layer: the database schema and the data needed to generate the JSON export
  (months, income, bills, accounts, and `account_balance_snapshots`).
- Tailscale/networking is an infrastructure prerequisite (outside app scope) but the Pi must have
  outbound network access to GitHub at backup time.
