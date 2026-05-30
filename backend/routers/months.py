"""Month CRUD, budget summary, detail, and carry-forward endpoints."""

import budget
import carry_forward
import models
import schemas
from database import get_db
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from routers.deps import get_or_404

router = APIRouter(prefix="/api/months", tags=["months"])


def _summary(db: Session, month: models.BudgetMonth) -> schemas.BudgetSummary:
    income = budget.total_income(db, month.id)
    bills = budget.total_bills(db, month.id)
    return schemas.BudgetSummary(
        month_id=month.id,
        month=month.month,
        total_income=income,
        total_bills=bills,
        monthly_surplus=income - bills,
        total_balances=budget.total_balances(db),
        total_savings=budget.total_savings(db),
    )


@router.get("", response_model=list[schemas.MonthRead])
def list_months(db: Session = Depends(get_db)):
    return db.scalars(select(models.BudgetMonth).order_by(models.BudgetMonth.month)).all()


@router.post("", response_model=schemas.MonthRead, status_code=status.HTTP_201_CREATED)
def create_month(payload: schemas.MonthCreate, db: Session = Depends(get_db)):
    existing = db.scalar(
        select(models.BudgetMonth).where(models.BudgetMonth.month == payload.month)
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Month {payload.month} already exists",
        )

    month = models.BudgetMonth(month=payload.month, notes=payload.notes)
    db.add(month)
    db.flush()

    if payload.carry_forward:
        carry_forward.apply_carry_forward(db, month, payload.overrides)

    db.commit()
    db.refresh(month)
    return month


@router.get("/carry-forward-preview", response_model=schemas.CarryForwardPreview)
def carry_forward_preview(
    month: str = Query(..., pattern=schemas.MONTH_PATTERN),
    db: Session = Depends(get_db),
):
    return carry_forward.preview(db, month)


@router.get("/{month_id}", response_model=schemas.MonthRead)
def get_month(month_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, models.BudgetMonth, month_id)


@router.patch("/{month_id}", response_model=schemas.MonthRead)
def update_month(month_id: int, payload: schemas.MonthUpdate, db: Session = Depends(get_db)):
    month = get_or_404(db, models.BudgetMonth, month_id)
    if payload.notes is not None:
        month.notes = payload.notes
        db.commit()
        db.refresh(month)
    return month


@router.delete("/{month_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_month(month_id: int, db: Session = Depends(get_db)):
    month = get_or_404(db, models.BudgetMonth, month_id)
    db.delete(month)
    db.commit()


@router.get("/{month_id}/summary", response_model=schemas.BudgetSummary)
def month_summary(month_id: int, db: Session = Depends(get_db)):
    month = get_or_404(db, models.BudgetMonth, month_id)
    return _summary(db, month)


@router.get("/{month_id}/detail", response_model=schemas.MonthDetail)
def month_detail(month_id: int, db: Session = Depends(get_db)):
    month = get_or_404(db, models.BudgetMonth, month_id)
    income = db.scalars(
        select(models.IncomeEntry).where(models.IncomeEntry.month_id == month_id)
    ).all()
    bills = db.scalars(select(models.Bill).where(models.Bill.month_id == month_id)).all()
    return schemas.MonthDetail(
        month=schemas.MonthRead.model_validate(month),
        income=[schemas.IncomeRead.model_validate(i) for i in income],
        bills=[schemas.BillRead.model_validate(b) for b in bills],
        summary=_summary(db, month),
    )
