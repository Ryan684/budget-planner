"""System health endpoints (Phase 5, US3).

``GET /api/backup-status`` surfaces the nightly backup's last outcome so the
dashboard can warn before data is at risk. Read-only, and always ``200`` — a
missing log is a valid "unknown" state, not an error.
"""

import backup_status
import schemas
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/backup-status", response_model=schemas.BackupStatusResponse)
def get_backup_status():
    result = backup_status.read_status()
    return schemas.BackupStatusResponse(
        status=result.status,
        last_run_at=result.last_run_at,
        stale=result.stale,
    )
