"""Amendments log read endpoint (append-only; never written via this router)."""

import models
import schemas
from database import get_db
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from routers.deps import get_or_404

router = APIRouter(prefix="/api/months", tags=["amendments"])


@router.get("/{month_id}/amendments", response_model=list[schemas.AmendmentRead])
def list_amendments(month_id: int, db: Session = Depends(get_db)):
    get_or_404(db, models.BudgetMonth, month_id)
    return db.scalars(
        select(models.Amendment)
        .where(models.Amendment.month_id == month_id)
        .order_by(models.Amendment.amended_at.desc(), models.Amendment.id.desc())
    ).all()
