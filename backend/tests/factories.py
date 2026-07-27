"""Small helpers to construct ORM rows directly in tests."""

from datetime import date, timedelta

import models

# Phase 5: "the current month" is the real calendar month, so tests that need an
# editable month must use today's key rather than a fixed literal.
CURRENT_MONTH = date.today().strftime("%Y-%m")
PREVIOUS_MONTH = (date.today().replace(day=1) - timedelta(days=1)).strftime("%Y-%m")


def make_month(session, month="2026-06", notes=None):
    row = models.BudgetMonth(month=month, notes=notes)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def make_income(session, month_id, label="Salary", amount=3000.0, is_recurring=True):
    row = models.IncomeEntry(
        month_id=month_id, label=label, amount=amount, is_recurring=is_recurring
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def make_bill(
    session,
    month_id,
    label="Mortgage",
    amount=1100.0,
    category="Housing",
    is_recurring=True,
    due_date=None,
):
    row = models.Bill(
        month_id=month_id,
        label=label,
        amount=amount,
        category=category,
        is_recurring=is_recurring,
        due_date=due_date,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def make_account(
    session, label="Joint current", balance=2300.0, account_type="current", as_of=None
):
    row = models.AccountBalance(
        label=label,
        balance=balance,
        account_type=account_type,
        as_of_date=as_of or date.today(),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
