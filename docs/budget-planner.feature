# Family Budget Planner — Feature Files (v3)
# Pots removed. Account balances replace pots as the real-money awareness layer.
# Negative/error scenarios are added per-feature as each phase is implemented.
# Phase 1 (data layer) error scenarios added for Income, Bills, Account Balances,
# and Amendments Log. Remaining phases will extend their own sections similarly.

Feature: Month Management

  Scenario: Create first ever month
    Given no months exist in the system
    When I create a new month for the current month
    Then a blank month is created with zero income and bills
    And the dashboard shows all figures as zero
    And surplus shows zero

  Scenario: Create new month with no previous month
    Given no previous month exists
    When I create a new month
    Then I am not prompted to carry forward anything
    And a blank month is created

  Scenario: Create new month with previous month data
    Given a previous month exists with recurring and non-recurring bills and income
    When I create a new month
    Then I am prompted to carry forward recurring items only
    And recurring income entries are pre-populated with last month's amounts
    And recurring bills are pre-populated with last month's amounts
    And non-recurring items are not carried forward

  Scenario: Account balances are not carried forward on month creation
    Given account balances exist from a previous month
    When I create a new month
    Then account balances are not duplicated or reset
    And the existing account balances remain unchanged and available

  Scenario: Amend carried-forward amount before confirming
    Given I am on the carry-forward confirmation screen
    When I change the amount of a carried-forward bill
    Then the new month is created with my amended amount
    And the previous month's amount is unchanged

  Scenario: Skip carry-forward
    Given I am prompted to carry forward recurring items
    When I choose to skip carry-forward
    Then a blank month is created
    And no items are pre-populated

  Scenario: Cannot create duplicate month
    Given a month already exists for June 2026
    When I attempt to create another month for June 2026
    Then I see an error stating that month already exists
    And no duplicate month is created

  Scenario: View a previous month
    Given multiple months exist
    When I navigate to a previous month
    Then I see that month's income, bills, and surplus figures
    And all fields are read-only
    And no Claude write actions are available

  Scenario: Switch back to current month
    Given I am viewing a previous month
    When I navigate back to the current month
    Then all fields are editable
    And the Claude screen is fully active


Feature: Income

  Scenario: Add a one-off income entry
    Given I am on the income screen for the current month
    When I add an income entry labelled "Freelance" for £500 marked as non-recurring
    Then the entry appears in the income list
    And total income increases by £500
    And surplus updates accordingly

  Scenario: Add a recurring income entry
    Given I am on the income screen for the current month
    When I add an income entry labelled "Ryan salary" for £3,200 marked as recurring
    Then the entry appears in the income list
    And it is flagged as recurring
    And it will be offered for carry-forward when the next month is created

  Scenario: Edit an income entry
    Given an income entry exists for "Ryan salary" at £3,200
    When I edit the amount to £3,400
    Then the income list shows £3,400
    And total income and surplus update immediately
    And the amendment is logged with source "user"

  Scenario: Delete an income entry
    Given an income entry exists
    When I delete it
    Then it is removed from the income list
    And total income and surplus update immediately

  Scenario: Total income updates in real time
    Given I have two income entries totalling £4,000
    When I add a third entry for £200
    Then total income shows £4,200 immediately

  # --- Error / negative scenarios (added during Phase 1 implementation) ---

  Scenario: Reject a negative income amount
    Given I am on the income screen for the current month
    When I add an income entry with an amount of -£50
    Then the entry is rejected as invalid
    And no income entry is created

  Scenario: Edit a non-existent income entry
    When I attempt to edit an income entry that does not exist
    Then I see a not-found error
    And nothing is changed

  Scenario: Delete a non-existent income entry
    When I attempt to delete an income entry that does not exist
    Then I see a not-found error

  Scenario: Add income to a non-existent month
    When I attempt to add an income entry to a month that does not exist
    Then I see a not-found error
    And no income entry is created


Feature: Bills

  Scenario: Add a recurring bill
    Given I am on the bills screen for the current month
    When I add a bill labelled "Mortgage" for £1,100 in category "Housing" marked as recurring
    Then the bill appears under the Housing category
    And total bills increases by £1,100
    And surplus updates accordingly

  Scenario: Add a one-off bill
    Given I am on the bills screen
    When I add a bill labelled "Boiler service" for £120 marked as non-recurring
    Then it appears in the bills list without a recurring indicator
    And it will not be offered for carry-forward next month

  Scenario: Edit a bill amount
    Given a bill exists for "Electricity" at £85
    When I edit the amount to £97
    Then the bill shows £97
    And total bills and surplus update immediately
    And the amendment is logged with source "user"

  Scenario: Delete a bill
    Given a bill exists
    When I delete it
    Then it is removed from the bills list
    And total bills and surplus update immediately

  Scenario: Bills grouped by category
    Given bills exist across multiple categories
    When I view the bills screen
    Then bills are visually grouped by category
    And each category shows a subtotal

  Scenario: Total bills exceed income warning
    Given total income is £3,000
    When total bills reach £3,100
    Then a visible warning is shown on the bills screen
    And surplus shows as negative
    And the dashboard reflects the negative surplus figure

  Scenario: Bill with due date
    Given I add a bill with a due date of the 1st of the month
    When I view the bills screen
    Then the due date is shown alongside the bill
    And bills with due dates are sorted by due date within their category

  # --- Error / negative scenarios (added during Phase 1 implementation) ---

  Scenario: Reject a negative bill amount
    Given I am on the bills screen for the current month
    When I add a bill with an amount of -£10
    Then the bill is rejected as invalid
    And no bill is created

  Scenario: Reject a bill due date outside the valid range
    Given I am on the bills screen for the current month
    When I add a bill with a due date of 32
    Then the bill is rejected as invalid
    And no bill is created

  Scenario: Edit a non-existent bill
    When I attempt to edit a bill that does not exist
    Then I see a not-found error
    And nothing is changed

  Scenario: Add a bill to a non-existent month
    When I attempt to add a bill to a month that does not exist
    Then I see a not-found error
    And no bill is created


Feature: Account Balances

  Scenario: Add an account balance
    Given I am on the accounts screen
    When I add an account labelled "Joint current" with a balance of £2,300 as of today
    Then the account appears in the accounts list
    And the total across all accounts updates immediately

  Scenario: Add multiple accounts
    Given I add three accounts: Joint current £2,300, Savings £8,400, Ryan ISA £12,000
    When I view the accounts screen
    Then all three accounts are listed
    And the total shows £22,700

  Scenario: Edit an account balance
    Given an account "Savings" exists with balance £8,400
    When I update the balance to £8,900
    Then the account shows £8,900
    And the total across all accounts updates immediately
    And the amendment is logged with source "user"

  Scenario: Update as-of date when editing balance
    Given an account "Joint current" was last updated two weeks ago
    When I edit the balance
    Then I can update the as-of date to today
    And the account shows the new date alongside the balance

  Scenario: Delete an account
    Given an account exists
    When I delete it
    Then it is removed from the accounts list
    And the total updates immediately

  Scenario: Accounts are not month-scoped
    Given accounts exist with current balances
    When I switch to view a previous month
    Then the accounts screen still shows current balances
    And accounts are not duplicated or historicised per month

  Scenario: Stale balance indicator
    Given an account balance was recorded more than 30 days ago
    When I view the accounts screen
    Then a visual indicator shows the balance may be stale
    And the as-of date is shown clearly

  # --- Error / negative scenarios (added during Phase 1 implementation) ---

  Scenario: Reject a negative account balance
    Given I am on the accounts screen
    When I add an account with a balance of -£1
    Then the account is rejected as invalid
    And no account is created

  Scenario: Edit a non-existent account
    When I attempt to edit an account that does not exist
    Then I see a not-found error
    And nothing is changed

  Scenario: Account balance change records the active month in the amendment
    Given an account "Savings" exists
    And the current active month is June 2026
    When I update the account balance
    Then the amendment is logged against June 2026
    And the amendment source is "user"


Feature: Dashboard

  Scenario: Dashboard shows correct summary figures
    Given income and bills are set for the current month
    When I view the dashboard
    Then I see total income, total bills, and monthly surplus
    And all figures are mathematically consistent

  Scenario: Dashboard shows account balances summary
    Given account balances exist
    When I view the dashboard
    Then I see the total across all accounts
    And I can navigate to the full accounts screen

  Scenario: Dashboard reflects real-time changes
    Given I am on the dashboard
    When a bill or income entry is added or amended on another screen
    And I return to the dashboard
    Then the figures reflect the latest state

  Scenario: Empty state dashboard
    Given no months exist
    When I open the app for the first time
    Then I see a prompt to create my first month
    And no figures or errors are shown


Feature: Claude — Querying

  Scenario: Ask a simple surplus question
    Given the current month has complete income and bills
    When I ask "what's our surplus this month?"
    Then Claude returns the correct surplus figure
    And the response references only current month data

  Scenario: Ask about account balances
    Given account balances are recorded
    When I ask "how much do we have in savings?"
    Then Claude returns the correct balance for savings accounts
    And notes the as-of date of the balance

  Scenario: Ask for a savings forecast
    Given the current month surplus is £600 and total savings balance is £8,400
    When I ask "if we save £500 a month when do we hit £20,000?"
    Then Claude calculates the correct timeline
    And bases it on the recorded account balance not an invented figure

  Scenario: Ask for a month comparison
    Given at least two months exist with complete data
    When I ask "how does this month compare to last month?"
    Then Claude fetches both months' data
    And provides a clear comparison of income, bills, and surplus

  Scenario: Ask for a month comparison with no previous month
    Given only the current month exists
    When I ask "how does this month compare to last month?"
    Then Claude explains there is no previous month to compare against
    And does not error or return empty data

  Scenario: Ask a scenario question
    Given the current month is active
    When I ask "if the mortgage goes up £150 what happens to our surplus?"
    Then Claude models the scenario against current data
    And does not write anything to the database

  Scenario: Claude references stale account balance
    Given an account balance was recorded 45 days ago
    When I ask Claude a question that uses that balance
    Then Claude notes that the balance may be out of date
    And includes the as-of date in its response


Feature: Claude — Writing

  Scenario: Claude adds a bill directly
    Given the current month is active
    When I ask Claude to "add a £45 water bill"
    Then Claude states the intended change and its effect on surplus before executing
    And the bill is written to the database in the same turn
    And the amendment is logged with source "claude" and an auto-populated reason
    And the dashboard figures update to reflect the new bill

  Scenario: Claude updates an account balance
    Given an account "Savings" exists with balance £8,400
    When I tell Claude "update savings to £8,900"
    Then Claude states the intended change
    And the balance is updated in the same turn
    And the amendment is logged with source "claude"

  Scenario: Claude edits a bill amount
    Given a bill "Electricity" exists for £85
    When I ask Claude to "change electricity to £97"
    Then Claude states the intended change and updated surplus
    And the bill is updated in the same turn
    And the amendment is logged with source "claude"

  Scenario: Claude deletes a bill
    Given a bill "Boiler service" exists for £120
    When I ask Claude to "remove the boiler service bill"
    Then Claude states the intended deletion and updated surplus
    And the bill is deleted in the same turn
    And the amendment is logged with source "claude"

  Scenario: Claude handles ambiguous instruction
    Given two bills exist both containing the word "insurance"
    When I ask Claude to "update the insurance bill to £50"
    Then Claude asks which insurance bill I mean before making any change
    And no write occurs until I clarify

  Scenario: Claude write on previous month blocked
    Given I am viewing a previous month in read-only mode
    When I attempt to ask Claude to make a change
    Then Claude explains it cannot write to previous months
    And no write occurs

  Scenario: Claude does not invent a figure
    Given the current month has no entry for broadband
    When I ask "how much is our broadband bill?"
    Then Claude states there is no broadband bill recorded
    And does not invent or approximate a figure


Feature: Undo

  Scenario: Undo last Claude change
    Given Claude has added a bill of £120 in the current session
    When I tap "Undo last Claude change"
    Then the bill is removed
    And the budget figures revert to their pre-change state
    And the undo button disappears or becomes inactive

  Scenario: Undo not available at session start
    Given I have just opened the Claude screen
    And Claude has not made any writes in this session
    Then the undo button is not visible or is inactive

  Scenario: Undo only reverts Claude writes
    Given I have manually edited a bill and Claude has also made a write
    When I tap "Undo last Claude change"
    Then only the Claude write is reverted
    And my manual bill edit is unchanged

  Scenario: Undo after multiple Claude writes
    Given Claude has made three writes in the current session
    When I tap "Undo last Claude change"
    Then only the most recent Claude write is reverted
    And the two earlier Claude writes remain


Feature: Amendments Log

  Scenario: User edit is logged correctly
    Given I manually change a bill amount
    Then an amendment is recorded with source "user"
    And the old and new values are both stored

  Scenario: Claude write is logged correctly
    Given Claude makes a write
    Then an amendment is recorded with source "claude"
    And the reason field is populated with Claude's stated intent
    And the old and new values are both stored

  Scenario: Amendments visible per month
    Given I am viewing a month with a history of changes
    When I access the amendments log for that month
    Then I see a chronological list of all changes
    And each entry shows source, field changed, old value, new value, reason, and timestamp

  # --- Added during Phase 1 implementation: all writes are logged, append-only ---

  Scenario: Creating an entry is logged
    When I add a new bill, income entry, or account
    Then an amendment is recorded with source "user"
    And the field changed is recorded as "created"

  Scenario: Deleting an entry is logged
    When I delete a bill, income entry, or account
    Then an amendment is recorded with source "user"
    And the field changed is recorded as "deleted"

  Scenario: Amendment history survives deletion of its entity
    Given a bill exists with a logged amendment
    When I delete that bill
    Then the bill is removed
    And its amendment history remains in the log

  # --- Added after Phase 2 testing: entity name must be visible in every amendment entry ---

  Scenario: Create and delete amendments identify the entity by name
    Given I add a bill labelled "Mortgage" for £1,100
    When I view the amendments log
    Then the entry shows "Mortgage (£1,100.00)" as the created value
    And the entity type "bill" is shown

  Scenario: Delete amendment for a bill identifies the bill by name
    Given a bill "Mortgage" exists for £1,100
    When I delete the bill
    And I view the amendments log
    Then the entry shows "Mortgage (£1,100.00)" as the removed value

  Scenario: Field-update amendment identifies the entity by name
    Given a bill "Electricity" exists at £85
    When I change the amount to £97
    And I view the amendments log
    Then the amendment shows "Electricity" alongside the old value £85 and new value £97


Feature: Backup
  # Phase 4 — clarified 2026-06-24: full-history JSON export, integrity
  # verification before commit, a stable database filename (the repo's commit
  # history is the version timeline), a local run log, catch-up scheduling, and
  # a tested recovery procedure.

  # --- User Story 1: unattended nightly offsite backup ---

  Scenario: Nightly offsite backup completes successfully
    Given the scheduled backup has been configured on the Pi with repository access
    When the nightly schedule fires
    Then a consistent copy of the database and a freshly generated full-history JSON export are committed and pushed to the private backup repository
    And the run records a timestamped success in the local backup log

  Scenario: A backup is verified before it is committed
    Given a backup run has produced a database copy and a JSON export
    When the database copy fails its SQLite integrity check or the JSON export does not parse
    Then the run fails with a non-zero exit and a logged reason
    And no commit or push is made over the previous good backup

  Scenario: The database is stored under a stable filename
    Given a successful backup last night
    When the routine runs again tonight with changed budget data
    Then a new commit is pushed under the same database filename
    And the previous version remains recoverable from the repository history

  Scenario: Unchanged data produces no misleading commit
    Given the budget data is unchanged since the last successful run
    When the routine runs
    Then it completes successfully without creating an empty or erroneous commit

  Scenario: A missed run catches up on next boot
    Given the Pi was powered off at the scheduled backup time
    When the Pi next boots
    Then the missed backup run executes rather than being skipped until the following night

  # --- User Story 2: reliable recovery from backup ---

  Scenario: Recovery from the backup repository
    Given a populated private backup repository
    And the live SQLite database has been lost or corrupted
    When an operator follows the recovery procedure to restore the database file and restart the app
    Then the app shows the same months, income, bills, accounts, and balances as the last backup

  Scenario: The JSON export is a standalone human-readable fallback
    Given a populated private backup repository
    And the binary database file is unreadable
    When an operator opens the JSON export
    Then every month's income, bills, and surplus and all account balances with their snapshot history are present and human-readable
    And it is valid JSON readable without the app

  # --- User Story 3: visibility into backup health ---

  Scenario: A failed run is recorded and leaves the previous good backup intact
    Given the network or the remote repository is unavailable
    When the routine runs
    Then it records a timestamped failure with a reason in the local backup log and exits non-zero
    And the previous good backup in the repository is unchanged
    And the next scheduled run can succeed once the failure is resolved


Feature: Polish & Hardening
  # Phase 5 — clarified 2026-07-26: an optional backend-verified PIN gate, income
  # and bills editable only in the current *calendar* month (notes and accounts
  # exempt), graceful retryable error states, a nightly-backup health banner, and
  # a README complete enough to bring up a fresh Pi.

  # --- User Story 1: optional PIN protects the app ---

  Scenario: A configured PIN gates the app on load
    Given a PIN is configured on the backend
    When I load the app
    Then a PIN entry screen is shown
    And no dashboard, income, bills, account, or Claude data is visible behind it

  Scenario: The correct PIN unlocks the app
    Given the PIN entry screen is showing
    When I enter the correct PIN
    Then the app unlocks and shows the dashboard
    And it stays unlocked while I navigate between screens

  Scenario: An incorrect PIN is rejected
    Given the PIN entry screen is showing
    When I enter an incorrect PIN
    Then an error is shown and the app stays locked
    And no financial data is revealed

  Scenario: No configured PIN means no gate
    Given no PIN is configured on the backend
    When I load the app
    Then the dashboard is shown immediately with no PIN step

  Scenario: Unlock lasts only for the browser session
    Given I have unlocked the app with the correct PIN
    When I reload the page in the same browser session
    Then the app is still unlocked
    But when the browser session ends and I reopen the app
    Then the PIN is required again

  Scenario: The configured PIN never reaches the browser
    Given a PIN is configured on the backend
    When the frontend verifies an entered PIN
    Then it posts the entry to the backend for checking
    And the configured PIN value appears nowhere in the delivered frontend bundle

  # --- User Story 2: previous months are read-only, reconciled to the calendar month ---

  Scenario: A previous month offers no income or bill editing
    Given a previous month is being viewed
    When its Income and Bills screens are shown
    Then no add, edit, or delete controls for that month's income or bills are available

  Scenario: The backend rejects a write to a previous month
    Given a previous month exists
    When a write to that month's income or bills is nonetheless attempted
    Then the backend rejects it with a clear "this month is read-only" error
    And no data changes

  Scenario: A future-dated month is read-only until its calendar month arrives
    Given a month dated after the current calendar month exists
    When its Income and Bills screens are shown
    Then no add, edit, or delete controls for its income or bills are available
    And a write to it is rejected by the backend

  Scenario: The current calendar month is fully editable
    Given the month matching the current calendar month is being viewed
    When its Income and Bills screens are shown
    Then full add, edit, and delete editing is available

  Scenario: Notes stay editable on any month
    Given a previous month is being viewed
    When I edit that month's free-text notes
    Then the change is accepted

  Scenario: Account balances stay editable from any month
    Given any month, current or previous, is being viewed
    When I use the Accounts screen
    Then account balances can still be added, edited, and deleted

  Scenario: Carry-forward is not blocked by the read-only rule
    Given a previous month with recurring items exists
    When I create the current calendar month by carrying items forward
    Then the new month is created with those items
    And the previous month is unchanged

  Scenario: Claude writes to the current calendar month
    Given the month matching the current calendar month exists
    When Claude makes a write
    Then it lands in that month

  Scenario: Claude has no write target when the calendar month is missing
    Given no month matches the current calendar month
    When Claude attempts a write
    Then it reports that there is no current month to write to

  Scenario: The dashboard prompts to create the current calendar month
    Given no month matches the current calendar month
    When the dashboard is loaded
    Then it offers to create this month rather than treating the latest month as editable

  # --- User Story 3: graceful error states and backup health ---

  Scenario: An unreachable backend shows a retryable error
    Given the backend is unreachable
    When any data screen is opened
    Then a clear error state with a retry option is shown within a few seconds
    And never an indefinite spinner or a blank screen

  Scenario: A Claude API failure preserves the conversation
    Given the Anthropic API is unavailable
    When I send a Claude message
    Then the Claude screen shows a friendly error
    And the conversation and my typed message are preserved for a retry

  Scenario: A failed write shows the true persisted state
    Given a write operation fails
    When the failure returns
    Then an error is shown
    And the screen reflects the true persisted state with no stale optimistic values

  Scenario: A failed nightly backup raises a dashboard banner
    Given the most recent nightly backup FAILED
    When the dashboard is loaded
    Then a warning banner is shown

  Scenario: A stale nightly backup raises a dashboard banner
    Given no successful backup has occurred within the staleness threshold
    When the dashboard is loaded
    Then a warning banner is shown

  Scenario: A healthy nightly backup raises no banner
    Given the most recent nightly backup succeeded within the staleness threshold
    When the dashboard is loaded
    Then no backup warning banner is shown

  Scenario: A missing backup log raises no false alarm
    Given no backup log is available, as in development
    When the dashboard is loaded
    Then the backup status is unknown
    And no backup warning banner is shown

  # --- User Story 4: fresh-Pi setup from the README ---

  Scenario: A fresh Pi is brought up from the README alone
    Given a bare Raspberry Pi and the README
    When the setup guide is followed end to end
    Then the backend, frontend, database on the USB SSD, and backup timer are all running
    And no step required knowledge outside the README

  Scenario: The end-to-end checklist confirms the deployment
    Given the completed setup
    When the end-to-end validation checklist is run
    Then each screen loads, a Claude query works, and a manually triggered backup produces a commit in the backup repository

  Scenario: The app is reachable remotely over Tailscale
    Given the README remote-access section has been followed
    Then the app is reachable from a phone over Tailscale
