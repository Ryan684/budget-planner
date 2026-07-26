#!/usr/bin/env bash
#
# Nightly backup orchestrator — Pi-only. NEVER run this in local development or CI
# (FR-014); it pushes to the offsite backup repository. It is invoked by the
# systemd unit budget-backup.service (see scripts/systemd/).
#
# All correctness-critical logic lives in the unit-tested backend/backup.py. This
# script only handles the single-instance lock, git, and the local run log:
#   1. take a non-blocking flock (concurrent-run guard)
#   2. run backup.py to write + verify the two artifacts
#   3. stage exactly those two files (never `git add -A` — secret-leak guard, FR-007)
#   4. if nothing changed, succeed without an empty commit (FR-010)
#   5. otherwise commit + push
#   6. append a timestamped SUCCESS / FAILED line to the local log on every path (FR-008)
#
# Contract: specs/004-backup-automation/contracts/backup-cli.md §B
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load the production environment (DATABASE_URL, BACKUP_REPO_DIR, BACKUP_LOG_FILE,
# BACKUP_LOCK_FILE) when present. systemd also loads this via EnvironmentFile; this
# keeps the script runnable for a manual operator test.
ENV_FILE="$REPO_ROOT/.env.production"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

: "${BACKUP_REPO_DIR:?BACKUP_REPO_DIR must be set (see .env.production)}"
: "${BACKUP_LOG_FILE:?BACKUP_LOG_FILE must be set (see .env.production)}"
: "${BACKUP_LOCK_FILE:?BACKUP_LOCK_FILE must be set (see .env.production)}"

timestamp() { date -u +%Y-%m-%dT%H:%M:%SZ; }
log() { echo "[$(timestamp)] $1" >>"$BACKUP_LOG_FILE"; }
fail() {
  log "FAILED: $1"
  exit 1
}

# Single-instance guard: a non-blocking exclusive lock. If another run holds it,
# record the conflict and exit non-zero without touching any artifact.
exec 9>"$BACKUP_LOCK_FILE"
if ! flock -n 9; then
  fail "another backup run is in progress (lock held)"
fi

DB_OUT="$BACKUP_REPO_DIR/budget.db"
JSON_OUT="$BACKUP_REPO_DIR/budget-export.json"

# Produce and verify the artifacts. A non-zero exit means a missing/empty source or
# a failed integrity/JSON check — in that case we never commit (FR-004a, FR-009).
if ! (cd "$REPO_ROOT/backend" && python backup.py --db-out "$DB_OUT" --json-out "$JSON_OUT"); then
  fail "backup.py (artifact generation/verification)"
fi

cd "$BACKUP_REPO_DIR" || fail "cannot enter backup repo dir ($BACKUP_REPO_DIR)"

# Stage only the two known artifacts — never `git add -A`/`.` (secret-leak guard).
git add budget.db budget-export.json || fail "git add"

# No change since the last successful run → succeed cleanly, no empty commit (FR-010).
if git diff --cached --quiet; then
  log "SUCCESS"
  exit 0
fi

git commit -m "Backup $(timestamp)" || fail "git commit"
git push || fail "git push"

log "SUCCESS"
exit 0
