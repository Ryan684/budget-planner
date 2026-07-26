# Quickstart: Backup Automation

Two audiences: (1) **developers** unit-testing `backend/backup.py` locally, and (2) **the operator**
setting up and verifying the real backup + recovery **on the Pi**. The real backup never runs in
local dev or CI (FR-014).

---

## 1. Developer — unit tests (any machine)

```bash
cd backend
pip install -e ".[dev]"          # if not already
pytest tests/test_backup.py      # unit tests for the Python backup module
ruff check . && ruff format --check .
```

You can also exercise the Python CLI against a throwaway DB **without** touching git or any remote:

```bash
cd backend
python backup.py --db-out /tmp/budget.db --json-out /tmp/budget-export.json
python -c "import json; print(list(json.load(open('/tmp/budget-export.json')).keys()))"
# -> ['exported_at', 'schema_version', 'data']
```

This is the only part of the feature that runs off-Pi. Do **not** run `scripts/backup.sh` locally.

---

## 2. Operator — one-time Pi setup

Prerequisites (Phase 0): USB SSD mounted; private backup repo created on GitHub; SSH key on the Pi
authorised against it.

1. **Clone the backup repo** onto the Pi (separate from the app source — FR-006):
   ```bash
   git clone git@github.com:<you>/budget-backup.git /mnt/usbssd/budget-backup
   ```
   Add a `.gitignore` that ignores everything except `budget.db`, `budget-export.json`, `README.md`.

2. **Set environment** in `.env.production`:
   ```
   DATABASE_URL=/mnt/usbssd/budget.db
   BACKUP_REPO_DIR=/mnt/usbssd/budget-backup
   BACKUP_LOG_FILE=/var/log/budget-backup.log
   BACKUP_LOCK_FILE=/run/budget-backup.lock
   ```

3. **Install systemd units** (catch-up scheduling):
   ```bash
   sudo cp scripts/systemd/budget-backup.service /etc/systemd/system/
   sudo cp scripts/systemd/budget-backup.timer   /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now budget-backup.timer
   systemctl list-timers budget-backup.timer      # confirm next run scheduled
   ```

---

## 3. Operator — verify a backup run (FR-012)

```bash
sudo systemctl start budget-backup.service        # run once now
journalctl -u budget-backup.service --no-pager    # see the run
tail -n 5 /var/log/budget-backup.log              # -> [<ts>] SUCCESS
```
On GitHub, confirm a new commit on the backup repo containing an updated `budget.db` and
`budget-export.json`. Open `budget-export.json` and confirm every month, all accounts, balance
snapshots, and amendments are present and it is valid JSON (FR-004 / US2 #2).

**Negative check**: temporarily break connectivity (or point at an unreachable remote) and run again;
confirm the log records `FAILED: ...`, the service exits non-zero, and the previous commit is intact.

---

## 4. Operator — recovery test (FR-012, US2) — MUST be executed

Simulate loss and restore from the backup alone:

1. Stop the app: `sudo systemctl stop budget-backend budget-frontend`.
2. Move the live DB aside: `mv /mnt/usbssd/budget.db /mnt/usbssd/budget.db.lost`.
3. Restore from the backup repo:
   ```bash
   cp /mnt/usbssd/budget-backup/budget.db /mnt/usbssd/budget.db
   ```
4. Restart: `sudo systemctl start budget-backend budget-frontend`.
5. **Verify** the app shows the same months, income, bills, accounts, and balances as the last
   backup (SC-003).

**JSON-only fallback (SC-004):** with the binary `.db` unavailable, confirm `budget-export.json`
alone still shows every month's figures and all account balances in human-readable form.

Record completion of this test in `docs/progress-log.md`.

---

## 5. Acceptance mapping

| Spec item | Verified by |
|---|---|
| FR-001 nightly + catch-up | §2 timer (`Persistent=true`), `list-timers` |
| FR-002 consistent copy | unit test (online backup round-trip) |
| FR-003 stable filename | §3 commit shows same `budget.db` path; history = versions |
| FR-004 full-history JSON | §3 inspect export; unit test on envelope/body |
| FR-004a / SC-008 verify before commit | unit tests (integrity + JSON parse); §3 negative check |
| FR-005/006 push to separate private repo | §2 clone, §3 commit on GitHub |
| FR-007 no secrets | unit test (no secret keys in export); explicit `git add` |
| FR-008 local log + non-zero exit | §3 `tail` log; negative check |
| FR-009 failure leaves good backup intact | §3 negative check |
| FR-010 no empty commit on no-change | re-run §3 with no data change → SUCCESS, no new commit |
| FR-011/013 documented setup + recovery | §2 + §4 (this file → README) |
| FR-012 recovery tested | §4 executed, logged in progress-log |
| FR-014 Pi-only | §1 note; script never run locally |
