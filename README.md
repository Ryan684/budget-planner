# Family Budget Planner

A private, self-hosted monthly budget planner for a family of two adults. Runs on a
Raspberry Pi 5, accessed from phones via a browser. See `docs/budget-planner-spec.md`
for the full specification.

**Contents**

- [Fresh-Pi setup](#fresh-pi-setup) — bring a bare Pi to a working deployment
- [Configuration reference](#configuration-reference)
- [Remote access (Tailscale)](#remote-access-tailscale)
- [Backup & Recovery](#backup--recovery)
- [End-to-end validation checklist](#end-to-end-validation-checklist)
- [Local development](#local-development)

---

## Fresh-Pi setup

Follow this section in order on a bare Raspberry Pi 5 and you will end with the app
running under systemd, its data on the USB SSD, nightly offsite backups, an optional PIN
lock, and remote access over Tailscale. Nothing here assumes knowledge from outside this
README.

Throughout, the source repo is assumed to live at `/home/pi/projects/budget-planner` and
the USB SSD to be mounted at `/mnt/usbssd`. Adjust paths if your deployment differs.

### 1. Runtime prerequisites

```bash
sudo apt update
sudo apt install -y git sqlite3 python3 python3-venv python3-pip curl
```

The backend targets **Python 3.14**. If the Pi's distribution ships something older,
install 3.14 alongside it (for example with [`uv`](https://docs.astral.sh/uv/):
`curl -LsSf https://astral.sh/uv/install.sh | sh && uv python install 3.14`) and use that
interpreter when creating the virtualenv below.

Node is needed only to **build** the frontend — the Pi serves the built static files:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # v22.x
```

### 2. Mount the USB SSD

The database must never live on the SD card — SD wear-out is the most likely way to lose
the data.

```bash
lsblk                                   # identify the SSD, e.g. /dev/sda1
sudo blkid /dev/sda1                    # note its UUID
sudo mkdir -p /mnt/usbssd
```

Add a line to `/etc/fstab` so it mounts on every boot (replace the UUID and, if not ext4,
the filesystem type):

```
UUID=<uuid>  /mnt/usbssd  ext4  defaults,noatime,nofail  0  2
```

```bash
sudo mount -a
sudo chown -R pi:pi /mnt/usbssd
findmnt /mnt/usbssd                     # confirm it is mounted
```

### 3. Get the source and install the backend

```bash
mkdir -p /home/pi/projects
git clone <your-repo-url> /home/pi/projects/budget-planner
cd /home/pi/projects/budget-planner/backend
python3.14 -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

### 4. Configure the environment

Create `/home/pi/projects/budget-planner/.env.production`. It is **gitignored** — it holds
your API key and PIN, so never commit it.

```
DATABASE_URL=/mnt/usbssd/budget.db
ANTHROPIC_API_KEY=sk-...
API_BASE_URL=http://<pi-lan-ip>:8000

# Optional 4-digit access PIN. Blank disables the lock screen entirely.
APP_PIN=1234

# Nightly backup (see Backup & Recovery below)
BACKUP_REPO_DIR=/mnt/usbssd/budget-backup
BACKUP_LOG_FILE=/var/log/budget-backup.log
BACKUP_LOCK_FILE=/run/budget-backup.lock

# Hours before a successful backup is considered stale and the dashboard warns.
BACKUP_STALE_HOURS=36
```

```bash
chmod 600 /home/pi/projects/budget-planner/.env.production
```

The backend reads this file at startup, so **restart `budget-backend` after any change** —
including changing `APP_PIN`.

### 5. Build the frontend

```bash
cd /home/pi/projects/budget-planner/frontend
npm ci
npm run build          # emits dist/
```

Rebuild after every `git pull` that touches `frontend/`.

### 6. Install the systemd services

Create `/etc/systemd/system/budget-backend.service`:

```ini
[Unit]
Description=Family Budget Planner — backend
After=network-online.target mnt-usbssd.mount
Requires=mnt-usbssd.mount

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/projects/budget-planner/backend
EnvironmentFile=/home/pi/projects/budget-planner/.env.production
ExecStart=/home/pi/projects/budget-planner/backend/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Create `/etc/systemd/system/budget-frontend.service` (serves the built `dist/`):

```ini
[Unit]
Description=Family Budget Planner — frontend
After=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/projects/budget-planner/frontend/dist
ExecStart=/usr/bin/python3 -m http.server 5173 --bind 0.0.0.0
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start both:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now budget-backend budget-frontend
systemctl status budget-backend budget-frontend --no-pager
curl -s http://localhost:8000/api/health          # -> {"status":"ok"}
```

Open `http://<pi-lan-ip>:5173` from a phone on the same WiFi. If `APP_PIN` is set you
should see the PIN screen; otherwise the dashboard loads straight away.

### 7. Set up the nightly backup

Follow [Backup & Recovery](#backup--recovery) below — the private backup repo, its SSH
key, and the systemd timer. The dashboard reads `BACKUP_LOG_FILE` and warns when the last
run failed or is older than `BACKUP_STALE_HOURS`, so this step is what makes backup health
visible in the app.

### 8. Set up remote access

Follow [Remote access (Tailscale)](#remote-access-tailscale) below.

---

## Configuration reference

All environment-specific values come from `.env.production` on the Pi (`.env.local` in
development). Nothing below is hardcoded in the app.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | `./data/budget-dev.db` | SQLite file location. On the Pi this must be on the USB SSD. |
| `ANTHROPIC_API_KEY` | for Claude | blank | Key for the in-app assistant. Blank means the Claude screen reports the assistant is unavailable. |
| `API_BASE_URL` | yes | — | Where the frontend reaches the backend. |
| `APP_PIN` | no | blank | 4-digit access PIN. Blank disables the lock screen. Verified by the backend, never shipped in the frontend bundle. |
| `BACKUP_REPO_DIR` | for backup | — | Local clone of the private backup repository. |
| `BACKUP_LOG_FILE` | for backup | blank | Run log the backup writes and the dashboard reads. Blank means backup status is "unknown" and no banner is shown. |
| `BACKUP_LOCK_FILE` | for backup | — | Single-instance lock for the backup run. |
| `BACKUP_STALE_HOURS` | no | `36` | Age at which a successful backup is treated as stale and the dashboard warns. 36h = one missed nightly run plus margin. |

**Secrets**: `.env.production` is gitignored and never leaves the Pi. The PIN and the API
key are excluded from everything sent to Claude and from the backup export.

---

## Remote access (Tailscale)

Tailscale is an infrastructure prerequisite, not part of the app — the app itself is never
exposed to the public internet.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Follow the printed URL to authenticate the Pi into your tailnet, then:

```bash
tailscale ip -4        # the Pi's tailnet IP, e.g. 100.x.y.z
tailscale status
```

Install the Tailscale app on each phone and sign into the same tailnet. The app is then
reachable off-LAN at `http://<tailscale-ip>:5173`.

If you set `API_BASE_URL` to the Pi's LAN IP, the frontend will not reach the backend from
off-LAN. Either use the Tailscale IP in `API_BASE_URL` (and restart `budget-backend`), or
enable [MagicDNS](https://tailscale.com/kb/1081/magicdns) and use the Pi's tailnet name so
one address works from both networks.

Optionally keep the Pi always connected:

```bash
sudo tailscale up --ssh --accept-routes
sudo systemctl enable tailscaled
```

---

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
   BACKUP_STALE_HOURS=36
   ```

   Ensure the `pi` user can write `BACKUP_LOG_FILE` and `BACKUP_LOCK_FILE`. The backend
   reads the same log to drive the dashboard's backup-health banner, so `BACKUP_LOG_FILE`
   must also be readable by the `budget-backend` service.

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

---

## End-to-end validation checklist

Run this on the Pi after a fresh setup to confirm every part is live. It is the
operator-run acceptance gate for the deployment — the same checklist as
`specs/005-polish-hardening/quickstart.md` Part B. Record completion in
`docs/progress-log.md`.

Requires the nightly backup timer from [Backup & Recovery](#backup--recovery) to be
installed first.

| # | Check | Pass when |
|---|---|---|
| 1 | **Prerequisites** — `findmnt /mnt/usbssd`, `python3.14 --version`, `node --version`, `sqlite3 --version` | SSD mounted and all three runtimes present |
| 2 | **Config** — `.env.production` holds `DATABASE_URL`, `ANTHROPIC_API_KEY`, `API_BASE_URL`, `APP_PIN`, `BACKUP_REPO_DIR`, `BACKUP_LOG_FILE`, `BACKUP_LOCK_FILE`, `BACKUP_STALE_HOURS` | Every value set; file mode `600` |
| 3 | **Services** — `systemctl status budget-backend budget-frontend` and open the app from a phone on the LAN | Both active; the app loads over the LAN |
| 4 | **Screens** — visit Dashboard, Income, Bills, Accounts, Amendments, Months, Claude | Every screen loads against the real database with no errors |
| 5 | **PIN** — with `APP_PIN` set, reload the app; enter a wrong PIN, then the correct one | Gate shown with no data behind it; wrong PIN rejected; correct PIN unlocks and survives a reload |
| 6 | **Read-only** — open a previous month, then the current one | The previous month offers no income/bill add/edit/delete; its notes still save; the current month edits fully; accounts edit from either |
| 7 | **Claude** — ask a real question, then ask for a bill change | A grounded answer returns; the write lands in the current calendar month with a `source:"claude"` amendment |
| 8 | **Backup** — `sudo systemctl start budget-backup.service`, then `tail -n 5 $BACKUP_LOG_FILE` and check the backup repo on GitHub | A `SUCCESS` line is logged, a new commit appears, and the dashboard shows **no** backup banner |
| 9 | **Backup alert** — append `[<timestamp>] FAILED: test` to the log, reload the dashboard, then remove the line and reload again | The warning banner appears, then clears |
| 10 | **Remote access** — from a phone off the LAN, open the app over Tailscale | The app loads and data displays |
| 11 | **Recovery** — follow [the recovery procedure](#d-recovery-procedure-restore-from-backup) | The app returns with the same months, income, bills, accounts, and balances |

Every step passing with no undocumented action required means the deployment is complete.

---

## Local development

Two processes, no Pi hardware needed. The nightly backup never runs locally.

**Backend**

```bash
cd backend
python3.14 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api to :8000
```

Create `.env.local` in the repo root:

```
DATABASE_URL=./data/budget-dev.db
ANTHROPIC_API_KEY=sk-...
API_BASE_URL=http://localhost:8000
APP_PIN=                 # blank disables the PIN gate in dev
```

Leave `BACKUP_LOG_FILE` unset in development: backup status reads as "unknown" and the
dashboard shows no banner, which is the intended dev behaviour rather than a false alarm.

**Quality gates** — run all of these before committing:

```bash
cd backend  && ruff check . && ruff format --check . && pytest
cd frontend && npm run lint && npx tsc --noEmit && npm run test
```

> **Never run `scripts/backup.sh` locally** — it pushes to the offsite backup repository.
