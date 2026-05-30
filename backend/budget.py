"""Pure budget calculation functions.

No FastAPI, no writes — these read from a SQLAlchemy session and return
figures. They are the primary mutation-testing target. Calculations must be
consistent with the frontend:

    total_income    = sum of income_entries for the month
    total_bills     = sum of bills for the month
    monthly_surplus = total_income - total_bills
    total_balances  = sum of all account balances
    total_savings   = sum of account balances where account_type == "savings"
"""

import models
from sqlalchemy import func, select
from sqlalchemy.orm import Session


def total_income(session: Session, month_id: int) -> float:
    result = session.scalar(
        select(func.coalesce(func.sum(models.IncomeEntry.amount), 0.0)).where(
            models.IncomeEntry.month_id == month_id
        )
    )
    return result or 0.0


def total_bills(session: Session, month_id: int) -> float:
    result = session.scalar(
        select(func.coalesce(func.sum(models.Bill.amount), 0.0)).where(
            models.Bill.month_id == month_id
        )
    )
    return result or 0.0


def monthly_surplus(session: Session, month_id: int) -> float:
    return total_income(session, month_id) - total_bills(session, month_id)


def total_balances(session: Session) -> float:
    result = session.scalar(select(func.coalesce(func.sum(models.AccountBalance.balance), 0.0)))
    return result or 0.0


def total_savings(session: Session) -> float:
    result = session.scalar(
        select(func.coalesce(func.sum(models.AccountBalance.balance), 0.0)).where(
            models.AccountBalance.account_type == "savings"
        )
    )
    return result or 0.0
