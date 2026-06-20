"""Claude integration endpoints. The only place the app calls the Anthropic API.

POST /api/claude       — send a message; returns the reply, any writes, and the
                         recalculated current-month figures.
POST /api/claude/undo  — reverse the most recent Claude turn's writes as a unit
                         (append-only: reversals are NEW amendments, not deletes).
"""

from datetime import date

import budget
import claude_client
import crud
import models
import schemas
from database import get_db
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from routers.deps import latest_month_id

router = APIRouter(prefix="/api/claude", tags=["claude"])

_MODEL_BY_TYPE = {
    "bill": models.Bill,
    "income": models.IncomeEntry,
    "account_balance": models.AccountBalance,
}

_ASSISTANT_UNAVAILABLE = "The assistant is unavailable right now. Please try again."


class _UndoError(Exception):
    """A Claude write could not be cleanly reversed."""


def _current_summary(db: Session) -> schemas.BudgetSummary | None:
    month_id = latest_month_id(db)
    if month_id is None:
        return None
    month = db.get(models.BudgetMonth, month_id)
    total_income = budget.total_income(db, month_id)
    total_bills = budget.total_bills(db, month_id)
    return schemas.BudgetSummary(
        month_id=month_id,
        month=month.month,
        total_income=total_income,
        total_bills=total_bills,
        monthly_surplus=total_income - total_bills,
        total_balances=budget.total_balances(db),
        total_savings=budget.total_savings(db),
    )


@router.post("", response_model=schemas.ClaudeResponse)
def claude_message(payload: schemas.ClaudeRequest, db: Session = Depends(get_db)):
    start_max = db.scalar(select(func.max(models.Amendment.id))) or 0
    try:
        result = claude_client.run_turn(db, payload)
    except claude_client.AssistantUnavailable as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=_ASSISTANT_UNAVAILABLE
        ) from exc

    if result.had_write_error:
        # Atomic: any tool failure rolls the whole turn back — no amendments persist.
        db.rollback()
        writes: list[schemas.ClaudeWrite] = []
    else:
        db.flush()  # assign amendment ids for any writes made this turn
        new_amendments = db.scalars(
            select(models.Amendment)
            .where(models.Amendment.id > start_max, models.Amendment.source == "claude")
            .order_by(models.Amendment.id)
        ).all()
        writes = [
            schemas.ClaudeWrite(
                amendment_id=a.id,
                entity_type=a.entity_type,
                entity_id=a.entity_id,
                entity_label=a.entity_label,
                field_changed=a.field_changed,
                old_value=a.old_value,
                new_value=a.new_value,
                reason=a.reason,
            )
            for a in new_amendments
        ]
        db.commit()

    return schemas.ClaudeResponse(reply=result.reply, writes=writes, summary=_current_summary(db))


# ---------------------------------------------------------------------------
# Undo
# ---------------------------------------------------------------------------
def _coerce(field: str, value: str | None):
    if value is None or value == "None":
        return None
    if field in ("amount", "balance"):
        return float(value)
    if field == "due_date":
        return int(value)
    if field == "is_recurring":
        return value == "True"
    if field == "as_of_date":
        return date.fromisoformat(value)
    return value


def _reverse(db: Session, amendment: models.Amendment) -> None:
    model = _MODEL_BY_TYPE.get(amendment.entity_type)
    if model is None:
        raise _UndoError(f"Cannot reverse a {amendment.entity_type} change.")
    reason = f"Undo of Claude change #{amendment.id}"

    if amendment.field_changed == "created":
        entity = db.get(model, amendment.entity_id)
        if entity is None:
            raise _UndoError("The created item no longer exists.")
        crud.delete_entity(
            db,
            entity,
            entity_type=amendment.entity_type,
            month_id=amendment.month_id,
            source="claude",
            reason=reason,
            commit=False,
        )
        return

    if amendment.field_changed == "deleted":
        # Re-creating a deleted entity from the summary is lossy; out of scope for MVP.
        raise _UndoError("Undo of a deletion is not supported.")

    # A field update: restore the old value.
    entity = db.get(model, amendment.entity_id)
    if entity is None:
        raise _UndoError("The changed item no longer exists.")
    crud.update_entity(
        db,
        entity,
        {amendment.field_changed: _coerce(amendment.field_changed, amendment.old_value)},
        entity_type=amendment.entity_type,
        month_id=amendment.month_id,
        source="claude",
        reason=reason,
        commit=False,
    )


@router.post("/undo", response_model=schemas.ClaudeUndoResponse)
def claude_undo(payload: schemas.ClaudeUndoRequest, db: Session = Depends(get_db)):
    # Reverse newest-first so dependent changes unwind in order.
    ids = sorted(set(payload.amendment_ids), reverse=True)
    amendments = []
    for aid in ids:
        amendment = db.get(models.Amendment, aid)
        if amendment is None:
            raise HTTPException(status_code=404, detail="Amendment not found")
        if amendment.source != "claude":
            raise HTTPException(status_code=422, detail="Only Claude changes can be undone")
        amendments.append(amendment)

    reverted: list[int] = []
    try:
        for amendment in amendments:
            _reverse(db, amendment)
            reverted.append(amendment.id)
        db.commit()
    except _UndoError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return schemas.ClaudeUndoResponse(reverted=reverted, summary=_current_summary(db))
