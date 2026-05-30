"""Account balance CRUD endpoints (not month-scoped).

Accounts are persistent records, independent of any budget month. Because the
``amendments`` log stamps the *active* budget month at the time of a change,
account writes accept an optional ``active_month_id`` (defaulting to the most
recent month) used only for the amendment record.
"""

from datetime import date

import budget
import crud
import models
import schemas
from database import get_db
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from routers.deps import get_or_404, latest_month_id

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=schemas.AccountList)
def list_accounts(db: Session = Depends(get_db)):
    accounts = db.scalars(select(models.AccountBalance)).all()
    return schemas.AccountList(
        accounts=[schemas.AccountRead.model_validate(a) for a in accounts],
        total_balances=budget.total_balances(db),
        total_savings=budget.total_savings(db),
    )


@router.post("", response_model=schemas.AccountRead, status_code=status.HTTP_201_CREATED)
def create_account(payload: schemas.AccountCreate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={"active_month_id"})
    if data.get("as_of_date") is None:
        data["as_of_date"] = date.today()
    account = models.AccountBalance(**data)
    month_id = payload.active_month_id or latest_month_id(db)
    return crud.create_entity(db, account, entity_type="account_balance", month_id=month_id)


@router.patch("/{account_id}", response_model=schemas.AccountRead)
def update_account(account_id: int, payload: schemas.AccountUpdate, db: Session = Depends(get_db)):
    account = get_or_404(db, models.AccountBalance, account_id)
    changes = payload.model_dump(exclude_unset=True, exclude={"active_month_id"})
    month_id = payload.active_month_id or latest_month_id(db)
    return crud.update_entity(
        db, account, changes, entity_type="account_balance", month_id=month_id
    )


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = get_or_404(db, models.AccountBalance, account_id)
    month_id = latest_month_id(db)
    crud.delete_entity(db, account, entity_type="account_balance", month_id=month_id)
