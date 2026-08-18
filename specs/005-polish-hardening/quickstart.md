# Quickstart: Polish & Hardening (Phase 5)

Two parts: **local validation** of the four polish slices (dev machine, no Pi), and the **fresh-Pi
end-to-end checklist** (FR-018, operator-run on real hardware).

---

## Part A — Local validation (dev machine)

Backend: `cd backend && uvicorn main:app --reload --port 8001`
Frontend: `cd frontend && npm run dev`

### A1. PIN gate (US1)

| Step | Expected |
|---|---|
| Set `APP_PIN=1234` in `.env.local`, restart backend, reload app | PIN screen shown; no dashboard/data behind it (FR-001) |
| Enter a wrong PIN | "Incorrect PIN"; stays locked; no data revealed (FR-004) |
| Enter `1234` | App unlocks to the dashboard; navigation stays unlocked (FR-003) |
| Reload the tab | Still unlocked (same browser session) |
| Close the browser / new session, reopen | PIN required again (FR-003) |
| Blank `APP_PIN`, restart backend, reload | Straight to dashboard, no gate (FR-002) |
| Confirm the PIN value is not in the built bundle | `npm run build && grep -r 1234 dist/` → no match (FR-005a) |

### A2. Previous-month read-only, calendar month (US2)

| Step | Expected |
|---|---|
| Ensure a month exists for the current calendar month + at least one older month | — |
| View the current calendar month → Income/Bills | Full add/edit/delete available (FR-007) |
| Switch to the older month → Income/Bills | No add/edit/delete controls (FR-006) |
| Edit the older month's **notes** | Allowed (notes stay editable) |
| Accounts screen from either month | Add/edit/delete works (FR-009) |
| `curl -X PATCH .../api/income/{id}` on an older-month income | `403` read-only error (FR-008) |
| Create a **future** month (e.g. next month) and open it | Read-only until its calendar month arrives |
| Ask Claude to add a bill | Writes to the current calendar month; if it isn't created, Claude says it has no month to write to |

### A3. Error states (US3)

| Step | Expected |
|---|---|
| Stop the backend, open any data screen | Retryable error within ~10s — no infinite spinner/blank (FR-011, SC-004) |
| Restart backend, click "Try again" | Screen recovers |
| Blank `ANTHROPIC_API_KEY` (or simulate 502), send a Claude message | Friendly error; conversation + typed message preserved; retry works (FR-012) |
| Force a write to fail (e.g. read-only 403) | Error shown; list reflects true persisted state, no stale value (FR-013) |

### A4. Backup-status banner (US3)

| Step | Expected |
|---|---|
| Leave `BACKUP_LOG_FILE` blank (dev default), load dashboard | No banner (status `unknown`, FR-016) |
| Point `BACKUP_LOG_FILE` at a temp file whose last line is `[<now>] SUCCESS` | No banner |
| Last line `[<40h ago>] SUCCESS` | Stale warning banner shown |
| Last line `[<now>] FAILED: git push` | Failure warning banner shown |
| `curl .../api/backup-status` for each of the above | `status`/`last_run_at`/`stale` match the contract |

Run the gates before committing: `ruff check . && ruff format --check . && pytest` (backend);
`npm run lint && npx tsc --noEmit && npm run test` (frontend); mutation tests per Constitution II.

---

## Part B — Fresh-Pi end-to-end checklist (FR-018, Pi-only, operator-run)

Goal: from a bare Raspberry Pi 5 and the README alone, reach a fully working, backed-up, remotely
accessible deployment. Requires Phase 4 to be deployed (backup timer). Record completion in
`docs/progress-log.md`.

1. **Prerequisites** — USB SSD mounted at `/mnt/usbssd`; Python 3.14, Node, SQLite installed per
   README. DB path `DATABASE_URL=/mnt/usbssd/budget.db`.
2. **Config** — `.env.production` set: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `APP_PIN`,
   `BACKUP_REPO_DIR`, `BACKUP_LOG_FILE`, `BACKUP_LOCK_FILE`, `BACKUP_STALE_HOURS`.
   (`API_BASE_URL` was removed on 2026-08-17 — the backend serves the frontend, so the app
   calls a relative `/api` on the origin that served it.)
3. **Service** — the `budget-backend` systemd service starts (it serves both the API and the built
   frontend on port 8001; `budget-frontend` no longer exists); app reachable on the
   LAN IP from a phone browser.
4. **Screens** — Dashboard, Income, Bills, Accounts, Amendments, Month Management, Claude all load
   against the real DB.
5. **PIN** — with `APP_PIN` set, the phone shows the PIN gate and unlocks on the correct PIN.
6. **Read-only** — a previous month shows no income/bills edit controls; the current month edits.
7. **Claude** — a real query returns; a write lands in the current calendar month with a
   `source:"claude"` amendment.
8. **Backup** — `sudo systemctl start budget-backup.service` → a commit appears in the backup repo
   and a `SUCCESS` line in `BACKUP_LOG_FILE`; the dashboard shows **no** backup banner.
9. **Backup alert** — append a `FAILED` line (or simulate a stale timestamp) → dashboard shows the
   warning banner; restore → banner clears.
10. **Remote access** — from off-LAN, reach the app over Tailscale per the README.
11. **Recovery** — follow the Phase 4 recovery procedure (clone backup repo, restore DB, restart) —
    app comes back with the same data.

Every step passing, with no undocumented action required, satisfies FR-017/FR-018 and SC-006.
