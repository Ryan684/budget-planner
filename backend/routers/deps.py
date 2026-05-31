"""Shared router helpers: fetch-or-404 and active-month resolution."""

import models
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session


def get_or_404(session: Session, model, entity_id: int):
    entity = session.get(model, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return entity


def latest_month_id(session: Session) -> int | None:
    return session.scalar(
        select(models.BudgetMonth.id).order_by(models.BudgetMonth.month.desc()).limit(1)
    )
