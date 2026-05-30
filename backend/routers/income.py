"""Income entry CRUD endpoints."""

import crud
import models
import schemas
from database import get_db
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from routers.deps import get_or_404

router = APIRouter(prefix="/api", tags=["income"])


@router.get("/months/{month_id}/income", response_model=list[schemas.IncomeRead])
def list_income(month_id: int, db: Session = Depends(get_db)):
    get_or_404(db, models.BudgetMonth, month_id)
    return db.scalars(
        select(models.IncomeEntry).where(models.IncomeEntry.month_id == month_id)
    ).all()


@router.post(
    "/months/{month_id}/income",
    response_model=schemas.IncomeRead,
    status_code=status.HTTP_201_CREATED,
)
def create_income(month_id: int, payload: schemas.IncomeCreate, db: Session = Depends(get_db)):
    get_or_404(db, models.BudgetMonth, month_id)
    entity = models.IncomeEntry(month_id=month_id, **payload.model_dump())
    return crud.create_entity(db, entity, entity_type="income", month_id=month_id)


@router.patch("/income/{income_id}", response_model=schemas.IncomeRead)
def update_income(income_id: int, payload: schemas.IncomeUpdate, db: Session = Depends(get_db)):
    entity = get_or_404(db, models.IncomeEntry, income_id)
    return crud.update_entity(
        db,
        entity,
        payload.model_dump(exclude_unset=True),
        entity_type="income",
        month_id=entity.month_id,
    )


@router.delete("/income/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_income(income_id: int, db: Session = Depends(get_db)):
    entity = get_or_404(db, models.IncomeEntry, income_id)
    crud.delete_entity(db, entity, entity_type="income", month_id=entity.month_id)
