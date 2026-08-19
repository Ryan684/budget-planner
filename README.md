# Family Budget Planner

A private, self-hosted monthly budget planner for a family of two adults. Runs on a
Raspberry Pi 5, accessed from phones via a browser. See `docs/budget-planner-spec.md`
for the full specification.

**Contents**

- [Fresh-Pi setup](#fresh-pi-setup) — bring a bare Pi to a working deployment
- [Configuration reference](#configuration-reference)
- [Sharing the Pi](#sharing-the-pi) — what the family dashboard on the same box owns
- [Remote access (Tailscale)](#remote-access-tailscale)
- [Backup & Recovery](#backup--recovery)
- [End-to-end validation checklist](#end-to-end-validation-checklist)
- [Local development](#local-development)

---

## Fresh-Pi setup

Follow this section in order on a bare Raspberry Pi 5 and you will end with the app
running under systemd, offsite backups every six hours, an optional PIN lock, and remote
access over Tailscale. No storage hardware beyond the Pi's own SD card is required —
see step 2. Nothing here assumes knowledge from outside this README.

Throughout, the source repo is assumed to live at `/home/pi/projects/budget-planner` and
its data (database + backup clone) in `/home/pi/budget-data`. Adjust paths if your
deployment differs.

> **This Pi is shared with the family dashboard** (`ryan684/family-dashboard`), which was
> deployed first and owns port 8000, the Chromium kiosk, and the 02:00 nightly deploy
> timer. If that app is already set up, Python 3.14 and Node 22 already exist, so step 1
> is done — start at step 2. See [Sharing the Pi](#sharing-the-pi) before changing any
> port, timer, or systemd unit.

### 1. Runtime prerequisites

```bash
sudo apt update
sudo apt install -y git sqlite3 curl
```

The backend targets **Python 3.14** (`requires-python = ">=3.14"`), while Raspberry Pi OS
Bookworm ships 3.11. Install 3.14 with [`uv`](https://docs.astral.sh/uv/), which downloads
a prebuilt aarch64 build rather than compiling for 10–20 minutes on the Pi:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
uv python install 3.14
echo "export PY314=\$(uv python find 3.14)" >> ~/.bashrc
source ~/.bashrc
$PY314 --version   # Python 3.14.x
```

**One interpreter for both apps.** The family dashboard uses this same 3.14 install
(`family-dashboard/PI_SETUP.md`, Part 6) — if it is already there, `$PY314` is already set
and there is nothing to do. Two interpreters installed two different ways is the drift
this is written to prevent.

Node is needed only to **build** the frontend — the Pi serves the built static files. Both
apps target Node 22, so install it once; if the dashboard is already deployed, skip this:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # v22.x
```

### 2. Create the data directory

The database and the local backup-repo clone live on the Pi's SD card, in a directory
outside the source tree so that nothing in `git` can touch them:

```bash
mkdir -p /home/pi/budget-data
```

That's it — no extra hardware.

**Why the SD card is acceptable here** (revised 2026-08-19; earlier revisions of this
README required a USB SSD and said "SD wear-out is the most likely way to lose the data"):

- **Wear is not the risk.** This app writes single-digit MB a month — a few dozen bills
  and income rows, occasional edits, an append-only amendments log. SD endurance is
  measured in terabytes written. That is several orders of magnitude of headroom.
- **The real risks are power-loss corruption and outright card death**, and both take the
  whole system with them, not just the database. An SSD would reduce the chance of losing
  the *data*, but you would still be reflashing and redeploying.
- **The offsite backup is what bounds the damage**, and it exists: see
  [Backup & Recovery](#backup--recovery). It runs every six hours, pushes to a private
  GitHub repository, and has a documented, tested recovery procedure. Worst case is
  losing the changes made since the last successful run.

The trade this makes: **the backup is now load-bearing, not a safety net.** Its Pi-only
end-to-end and recovery gates are not optional — run them before relying on this
deployment, and take the dashboard's staleness banner seriously when it appears.

If you would rather reduce the probability as well as bound the impact, an old SSD in a
USB caddy still works — set `DATABASE_URL` and `BACKUP_REPO_DIR` to a path on it and
everything below is unchanged. A small UPS addresses the power-loss failure mode more
directly than an SSD does.

### 3. Get the source and install the backend

```bash
mkdir -p /home/pi/projects
git clone <your-repo-url> /home/pi/projects/budget-planner
cd /home/pi/projects/budget-planner/backend
"$PY314" -m venv .venv
# Install from the lockfile, not the resolver: the Pi then gets the exact versions
# that were tested, rather than whatever PyPI resolves to that night. The package
# itself goes in --no-deps because the lockfile already provided everything.
.venv/bin/pip install -r requirements.lock
.venv/bin/pip install -e . --no-deps
```

`requirements.lock` holds runtime dependencies only. On a development machine, install the
test and lint tooling too with `pip install -e ".[dev]"`. Regenerate the lock whenever
`pyproject.toml` changes, on a machine with uv:

```bash
uv pip compile pyproject.toml --universal --python-version 3.14 -o requirements.lock
```

### 4. Configure the environment

Create `/home/pi/projects/budget-planner/.env.production`. It is **gitignored** — it holds
your API key and PIN, so never commit it.

```
DATABASE_URL=/home/pi/budget-data/budget.db
ANTHROPIC_API_KEY=sk-...

# Optional 4-digit access PIN. Blank disables the lock screen entirely.
APP_PIN=1234

# Scheduled backup (see Backup & Recovery below)
BACKUP_REPO_DIR=/home/pi/budget-data/budget-backup
BACKUP_LOG_FILE=/var/log/budget-backup.log
BACKUP_LOCK_FILE=/run/budget-backup.lock

# Hours before a successful backup is considered stale and the dashboard warns.
# 12 = two missed runs of the 6-hourly timer, plus margin.
BACKUP_STALE_HOURS=12
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
NODE_OPTIONS="--max-old-space-size=1024" npm run build   # emits dist/
```

The backend serves `dist/` itself, so there is nothing to configure here and no separate
static server — see [Sharing the Pi](#sharing-the-pi). The app calls a relative `/api` on
whatever origin served it, which is why no API base URL appears in `.env.production`.

The heap cap keeps V8 from sizing itself off total system memory (~2GB on this 4GB Pi)
for a build that needs a fraction of it. Run this while the dashboard's Chromium kiosk is
stopped if you can — either overnight, or after `family-dashboard/scripts/stop-kiosk.sh`.

Rebuild after every `git pull` that touches `frontend/`.

### 6. Install the systemd service

One service, not two: the backend serves both the API and the built frontend.

Create `/etc/systemd/system/budget-backend.service`:

```ini
[Unit]
Description=Family Budget Planner — backend and UI
After=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/projects/budget-planner/backend
EnvironmentFile=/home/pi/projects/budget-planner/.env.production
ExecStart=/home/pi/projects/budget-planner/backend/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001
Restart=on-failure
RestartSec=5
# Bound a leak so it can never reach the family dashboard's backend or the kiosk
# on this shared 4GB Pi. On breach systemd kills this service and Restart brings
# it back — better than the whole box thrashing.
MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

**Port 8001, not 8000.** The family dashboard sharing this Pi owns 8000; two services
cannot bind the same port, and the loser would crash-loop under `Restart=on-failure`.
See [Sharing the Pi](#sharing-the-pi).

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now budget-backend
systemctl status budget-backend --no-pager
curl -s http://localhost:8001/api/health          # -> {"status":"ok"}
```

Open `http://<pi-lan-ip>:8001` from a phone on the same WiFi. If `APP_PIN` is set you
should see the PIN screen; otherwise the dashboard loads straight away.

> **Upgrading from an earlier setup?** Remove the old static-file service, which no longer
> exists: `sudo systemctl disable --now budget-frontend && sudo rm
> /etc/systemd/system/budget-frontend.service && sudo systemctl daemon-reload`.

### 7. Set up the scheduled backup

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
| `DATABASE_URL` | yes | `./data/budget-dev.db` | SQLite file location. On the Pi, `/home/pi/budget-data/budget.db`. |
| `ANTHROPIC_API_KEY` | for Claude | blank | Key for the in-app assistant. Blank means the Claude screen reports the assistant is unavailable. |
| `APP_PIN` | no | blank | 4-digit access PIN. Blank disables the lock screen. Verified by the backend, never shipped in the frontend bundle. |
| `BACKUP_REPO_DIR` | for backup | — | Local clone of the private backup repository. |
| `BACKUP_LOG_FILE` | for backup | blank | Run log the backup writes and the dashboard reads. Blank means backup status is "unknown" and no banner is shown. |
| `BACKUP_LOCK_FILE` | for backup | — | Single-instance lock for the backup run. |
| `BACKUP_STALE_HOURS` | no | `12` | Age at which a successful backup is treated as stale and the dashboard warns. 12h = two missed runs of the 6-hourly timer plus margin. |

**Secrets**: `.env.production` is gitignored and never leaves the Pi. The PIN and the API
key are excluded from everything sent to Claude and from the backup export.

---

## Sharing the Pi

This app shares one Raspberry Pi 5 (4GB) with the **family dashboard**
(`ryan684/family-dashboard`), a kitchen kiosk display deployed first. They are independent
deployments sharing one box, one Python interpreter and one Node install.
Reconciled 2026-08-17. The dashboard's `hardware.md` holds the full picture; this is what
matters when working on the budget planner.

| | budget-planner | family-dashboard |
|---|---|---|
| Backend port | **8001**, bound `0.0.0.0` | 8000, bound `127.0.0.1` |
| Frontend | `dist/` served by this backend | `dist/` served by its own backend |
| Systemd units | `budget-backend`, `budget-backup.{service,timer}` | `family-dashboard`, `family-dashboard-deploy.{service,timer}` |
| Persistent data | `/home/pi/budget-data/` (SD card) | none (stateless) |
| Scheduled job | backup, **03:30 / 09:30 / 15:30 / 21:30** | deploy, 02:00 |

**Do not move this app back to port 8000.** Both backends previously bound `0.0.0.0:8000`;
whichever started second would have failed with "address already in use" and crash-looped
under `Restart=on-failure`. Dev matches production (`vite.config.ts` proxies to 8001) so
both apps can also run on a laptop at once.

**Do not move a backup run into 02:00–03:00.** The dashboard's deploy runs at 02:00 and
its `npm ci` + `vite build` can take 15–30 minutes on this hardware. The 6-hourly backup
schedule (03:30 / 09:30 / 15:30 / 21:30) is chosen to stay clear of it.

**Memory is the binding constraint.** Steady state is comfortable — roughly 2.5GB free
with the kiosk up — but transient build spikes are not, which is why:

- the dashboard stops Chromium at 22:00, freeing ~0.5GB across the whole overnight window;
- `budget-backend` carries `MemoryMax=512M` so a leak here cannot reach the kiosk;
- frontend builds run with `NODE_OPTIONS=--max-old-space-size=1024`;
- **mutation testing never runs on the Pi** — see below.

Before adding anything long-running to this Pi, or moving a port or timer, read
`family-dashboard/hardware.md`, "Sharing the Pi with the budget planner".

### Mutation testing is a development-machine step

`npm run test:mutation` (Stryker) and `mutmut run` are far heavier than anything else in
this repo — Stryker spawns parallel Vitest workers, mutmut re-runs the whole suite per
mutant. Either will exhaust 4GB with the kiosk and both backends live, and the OOM killer
will take out a running service. `scripts/assert-not-pi.sh` guards the npm script and
should prefix any `mutmut run`; it refuses on Raspberry Pi hardware and explains why.

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
reachable off-LAN at `http://<tailscale-ip>:8001`.

Nothing else needs configuring: the backend serves the frontend, and the app calls a
relative `/api` on whatever origin served it, so the same build works over the LAN and
over Tailscale with no rebuild. Enable
[MagicDNS](https://tailscale.com/kb/1081/magicdns) if you would rather use the Pi's
tailnet name than its IP.

Note that this puts the app on your tailnet with no network-level authentication in front
of it — `APP_PIN` is the only gate, so set it. The family dashboard sharing this Pi binds
to `127.0.0.1` precisely because it has no equivalent.

Optionally keep the Pi always connected:

```bash
sudo tailscale up --ssh --accept-routes
sudo systemctl enable tailscaled
```

---

## Backup & Recovery

The Pi takes an unattended **offsite backup every six hours** of the SQLite database to a
**private** GitHub repository, plus a human-readable JSON export, and keeps a local run
log. The binary `.db` copy is the restore path; the JSON export is a standalone fallback
if the binary is ever unreadable.

> The backup runs **only on the Pi**. Never run `scripts/backup.sh` in local development —
> it pushes to the offsite repository.

The examples below assume the app source repo is at `/home/pi/projects/budget-planner`
and the database in `/home/pi/budget-data`. Adjust paths if your deployment differs.

### (a) One-time Pi setup

**Prerequisites (Phase 0):** the data directory created (step 2); the private backup repo created on GitHub;
an SSH key on the Pi authorised against it.

1. **Clone the backup repository** onto the Pi — it must be **separate** from this source
   repo (FR-006):

   ```bash
   git clone git@github.com:<you>/budget-backup.git /home/pi/budget-data/budget-backup
   ```

2. **Install the backup repo's `.gitignore`** so only the two artifacts can ever be
   committed (secret-leak guard, FR-007):

   ```bash
   cp /home/pi/projects/budget-planner/scripts/backup-repo.gitignore \
      /home/pi/budget-data/budget-backup/.gitignore
   ```

3. **Set the backup environment** in `/home/pi/projects/budget-planner/.env.production`:

   ```
   DATABASE_URL=/home/pi/budget-data/budget.db
   BACKUP_REPO_DIR=/home/pi/budget-data/budget-backup
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

The timer fires every six hours (03:30 / 09:30 / 15:30 / 21:30) with `Persistent=true`, so a run missed while the Pi was
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
   sudo systemctl stop budget-backend
   ```

2. Move the bad database aside (if present):

   ```bash
   mv /home/pi/budget-data/budget.db /home/pi/budget-data/budget.db.lost   # skip if already gone
   ```

3. Restore the database file from the backup repo:

   ```bash
   cp /home/pi/budget-data/budget-backup/budget.db /home/pi/budget-data/budget.db
   ```

4. Restart the app:

   ```bash
   sudo systemctl start budget-backend
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

Requires the backup timer from [Backup & Recovery](#backup--recovery) to be
installed first.

| # | Check | Pass when |
|---|---|---|
| 1 | **Prerequisites** — `ls -ld /home/pi/budget-data`, `python3.14 --version`, `node --version`, `sqlite3 --version` | Data directory present and writable by `pi`; all three runtimes present |
| 2 | **Config** — `.env.production` holds `DATABASE_URL`, `ANTHROPIC_API_KEY`, `APP_PIN`, `BACKUP_REPO_DIR`, `BACKUP_LOG_FILE`, `BACKUP_LOCK_FILE`, `BACKUP_STALE_HOURS` | Every value set; file mode `600` |
| 3 | **Service** — `systemctl status budget-backend`, then open `http://<pi-lan-ip>:8001` from a phone on the LAN | Active; the app and its assets load over the LAN, served by the backend itself |
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

Two processes, no Pi hardware needed. The scheduled backup never runs locally.

**Backend**

```bash
cd backend
"$PY314" -m venv .venv          # or any Python 3.14 interpreter
.venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn main:app --reload --port 8001
```

**Frontend**

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api to :8001
```

Create `.env.local` in the repo root:

```
DATABASE_URL=./data/budget-dev.db
ANTHROPIC_API_KEY=sk-...
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
