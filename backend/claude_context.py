"""Build the privacy-bounded financial context sent to Claude.

This is the ONLY data that leaves the app for the Anthropic API. It contains the
household's structured financial picture and NOTHING else — never the raw
database file, application secrets, ``.env`` contents, or the PIN (FR-022,
Constitution Principle IV). The payload is assembled here from the live database
on every request and is deterministic (stable key order) so it is reproducible
and testable.
"""

from datetime import date

import budget
import current_month
import models
from sqlalchemy import select
from sqlalchemy.orm import Session

# A balance is "stale" once its observation date is this many days old. Reuses
# the Phase 2 dashboard rule.
STALE_DAYS = 30


def is_stale(as_of: date, *, today: date | None = None) -> bool:
    """True when the balance's as-of date is >= STALE_DAYS old."""
    today = today or date.today()
    return (today - as_of).days >= STALE_DAYS


def build_budget_context(session: Session) -> dict:
    """Assemble the full multi-month financial picture for Claude to read."""
    months = session.scalars(select(models.BudgetMonth).order_by(models.BudgetMonth.month)).all()

    month_payload = []
    for m in months:
        income = session.scalars(
            select(models.IncomeEntry).where(models.IncomeEntry.month_id == m.id)
        ).all()
        bills = session.scalars(select(models.Bill).where(models.Bill.month_id == m.id)).all()
        total_income = budget.total_income(session, m.id)
        total_bills = budget.total_bills(session, m.id)
        month_payload.append(
            {
                "id": m.id,
                "month": m.month,
                "income": [
                    {
                        "id": i.id,
                        "label": i.label,
                        "amount": i.amount,
                        "is_recurring": i.is_recurring,
                    }
                    for i in income
                ],
                "bills": [
                    {
                        "id": b.id,
                        "label": b.label,
                        "amount": b.amount,
                        "category": b.category,
                        "is_recurring": b.is_recurring,
                        "due_date": b.due_date,
                    }
                    for b in bills
                ],
                "summary": {
                    "total_income": total_income,
                    "total_bills": total_bills,
                    "monthly_surplus": total_income - total_bills,
                },
            }
        )

    accounts = session.scalars(select(models.AccountBalance)).all()
    account_payload = [
        {
            "id": a.id,
            "label": a.label,
            "balance": a.balance,
            "account_type": a.account_type,
            "as_of_date": a.as_of_date.isoformat(),
            "is_stale": is_stale(a.as_of_date),
        }
        for a in accounts
    ]

    snapshots = session.scalars(
        select(models.AccountBalanceSnapshot).order_by(
            models.AccountBalanceSnapshot.as_of_date,
            models.AccountBalanceSnapshot.recorded_at,
        )
    ).all()
    snapshot_payload = [
        {
            "account_id": s.account_id,
            "balance": s.balance,
            "as_of_date": s.as_of_date.isoformat(),
        }
        for s in snapshots
    ]

    amendments = session.scalars(
        select(models.Amendment).order_by(models.Amendment.amended_at)
    ).all()
    amendment_payload = [
        {
            "id": am.id,
            "month_id": am.month_id,
            "entity_type": am.entity_type,
            "entity_label": am.entity_label,
            "field_changed": am.field_changed,
            "old_value": am.old_value,
            "new_value": am.new_value,
            "reason": am.reason,
            "source": am.source,
            "amended_at": am.amended_at.isoformat(),
        }
        for am in amendments
    ]

    return {
        "current_month_id": current_month.current_month_id(session),
        "months": month_payload,
        "accounts": account_payload,
        "balance_snapshots": snapshot_payload,
        "amendments": amendment_payload,
    }
