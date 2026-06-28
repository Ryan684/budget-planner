# Family Budget Planner

A private, self-hosted monthly budget planner for a family of two adults. Runs on a
Raspberry Pi 5, accessed from phones via a browser. See `docs/budget-planner-spec.md`
for the full specification.

> This README currently documents **Backup & Recovery** (Phase 4). Phase 5 expands it
> into the full setup and operations guide.

## Backup & Recovery

The Pi takes an unattended **nightly offsite backup** of the SQLite database to a
**private** GitHub repository, plus a human-readable JSON export, and keeps a local run
log. The binary `.db` copy is the restore path; the JSON export is a standalone fallback
if the binary is ever unreadable.

> The backup runs **only on the Pi**. Never run `scripts/backup.sh` in local development —
> it pushes to the offsite repository.

The examples below assume the app source repo is at `/home/pi/projects/budget-planner`
and the database is on the USB SSD. Adjust paths if your deployment differs.

### (a) One-time Pi setup

**Prerequisites (Phase 0):** USB SSD mounted; the private backup repo created on GitHub;
an SSH key on the Pi authorised against it.

1. **Clone the backup repository** onto the Pi — it must be **separate** from this source
   repo (FR-006):

   ```bash
   git clone git@github.com:<you>/budget-backup.git /mnt/usbssd/budget-backup
   ```

2. **Install the backup repo's `.gitignore`** so only the two artifacts can ever be
   committed (secret-leak guard, FR-007):

   ```bash
   cp /home/pi/projects/budget-planner/scripts/backup-repo.gitignore \
      /mnt/usbssd/budget-backup/.gitignore
   ```

3. **Set the backup environment** in `/home/pi/projects/budget-planner/.env.production`:

   ```
   DATABASE_URL=/mnt/usbssd/budget.db
   BACKUP_REPO_DIR=/mnt/usbssd/budget-backup
   BACKUP_LOG_FILE=/var/log/budget-backup.log
   BACKUP_LOCK_FILE=/run/budget-backup.lock
   ```

   Ensure the `pi` user can write `BACKUP_LOG_FILE` and `BACKUP_LOCK_FILE`.

### (b) Install the systemd timer (catch-up scheduling)

```bash
sudo cp /home/pi/projects/budget-planner/scripts/systemd/budget-backup.service /etc/systemd/system/
sudo cp /home/pi/projects/budget-planner/scripts/systemd/budget-backup.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now budget-backup.timer
systemctl list-timers budget-backup.timer      # confirm the next run is scheduled
```

The timer fires nightly at 02:30 with `Persistent=true`, so a run missed while the Pi was
powered off executes on the next boot (FR-001).

### (c) Verify a backup run

```bash
sudo systemctl start budget-backup.service        # run once now
journalctl -u budget-backup.service --no-pager     # inspect the run
tail -n 5 /var/log/budget-backup.log               # -> [<timestamp>] SUCCESS
```

On GitHub, confirm a new commit on the backup repo containing an updated `budget.db` and
`budget-export.json`. Open `budget-export.json` and confirm every month, all accounts,
balance snapshots, and amendments are present and it is valid JSON.

**Negative check:** temporarily break connectivity (or point at an unreachable remote) and
run again; confirm the log records `FAILED: ...`, the service exits non-zero, and the
previous commit is left intact.

### (d) Recovery procedure (restore from backup)

If the live database is lost or corrupted, restore it from the backup repo alone:

1. Stop the app:

   ```bash
   sudo systemctl stop budget-backend budget-frontend
   ```

2. Move the bad database aside (if present):

   ```bash
   mv /mnt/usbssd/budget.db /mnt/usbssd/budget.db.lost   # skip if already gone
   ```

3. Restore the database file from the backup repo:

   ```bash
   cp /mnt/usbssd/budget-backup/budget.db /mnt/usbssd/budget.db
   ```

4. Restart the app:

   ```bash
   sudo systemctl start budget-backend budget-frontend
   ```

5. **Verify** the app shows the same months, income, bills, accounts, and balances as the
   last backup.

### (e) JSON-only fallback

If the binary `budget.db` is itself unreadable, the financial history is still recoverable
by hand from `budget-export.json` in the backup repo: every month's income, bills, and
surplus, plus all account balances and their snapshot history, are present in human-readable
JSON that opens without the app.
