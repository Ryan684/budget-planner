"""Shared router helpers: fetch-or-404, month resolution, and the read-only guard."""

import current_month
import models
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

READ_ONLY_DETAIL = "This month is read-only — only the current month can be edited"


def get_or_404(session: Session, model, entity_id: int):
    entity = session.get(model, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return entity


def latest_month_id(session: Session) -> int | None:
    """The newest month on file. Used only to stamp account amendments with the
    month in view — never to decide what may be written (see current_month)."""
    return session.scalar(
        select(models.BudgetMonth.id).order_by(models.BudgetMonth.month.desc()).limit(1)
    )


def current_calendar_month_id(session: Session) -> int | None:
    """The only month whose income and bills may be written (Phase 5, US2)."""
    return current_month.current_month_id(session)


def require_editable_month(session: Session, month_id: int) -> None:
    """Reject a write to any month other than the current calendar month (FR-008).

    Defence-in-depth behind the UI: historical months are the audit record the
    household reasons against, and a future-dated month is not editable until its
    calendar month arrives. When today's month has not been created, nothing is
    editable. Callers resolve 404s first so a missing entity still wins.
    """
    if month_id != current_calendar_month_id(session):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=READ_ONLY_DETAIL)
