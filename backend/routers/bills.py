"""Bill CRUD endpoints."""

import crud
import models
import schemas
from database import get_db
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from routers.deps import get_or_404

router = APIRouter(prefix="/api", tags=["bills"])


@router.get("/months/{month_id}/bills", response_model=list[schemas.BillRead])
def list_bills(month_id: int, db: Session = Depends(get_db)):
    get_or_404(db, models.BudgetMonth, month_id)
    return db.scalars(
        select(models.Bill)
        .where(models.Bill.month_id == month_id)
        .order_by(models.Bill.category, models.Bill.due_date)
    ).all()


@router.post(
    "/months/{month_id}/bills",
    response_model=schemas.BillRead,
    status_code=status.HTTP_201_CREATED,
)
def create_bill(month_id: int, payload: schemas.BillCreate, db: Session = Depends(get_db)):
    get_or_404(db, models.BudgetMonth, month_id)
    entity = models.Bill(month_id=month_id, **payload.model_dump())
    return crud.create_entity(db, entity, entity_type="bill", month_id=month_id)


@router.patch("/bills/{bill_id}", response_model=schemas.BillRead)
def update_bill(bill_id: int, payload: schemas.BillUpdate, db: Session = Depends(get_db)):
    entity = get_or_404(db, models.Bill, bill_id)
    return crud.update_entity(
        db,
        entity,
        payload.model_dump(exclude_unset=True),
        entity_type="bill",
        month_id=entity.month_id,
    )


@router.delete("/bills/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    entity = get_or_404(db, models.Bill, bill_id)
    crud.delete_entity(db, entity, entity_type="bill", month_id=entity.month_id)
