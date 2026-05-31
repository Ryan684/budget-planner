"""Month carry-forward: preview recurring items and apply them to a new month.

"Most recent previous month" is the month whose ``month`` string sorts highest
while still being strictly less than the target (valid because YYYY-MM sorts
lexicographically). Only recurring income and bills are carried; non-recurring
items and account balances are never carried. The previous month is never
mutated — carried items are inserted as new rows on the new month.
"""

import models
import schemas
from sqlalchemy import select
from sqlalchemy.orm import Session


def _previous_month(session: Session, target_month: str) -> models.BudgetMonth | None:
    return session.scalar(
        select(models.BudgetMonth)
        .where(models.BudgetMonth.month < target_month)
        .order_by(models.BudgetMonth.month.desc())
        .limit(1)
    )


def preview(session: Session, target_month: str) -> schemas.CarryForwardPreview:
    """Recurring income + bills that would carry forward into ``target_month``."""
    prev = _previous_month(session, target_month)
    if prev is None:
        return schemas.CarryForwardPreview(from_month=None, income=[], bills=[])

    income = [
        schemas.CarryForwardItem(
            source_type="income", source_id=i.id, label=i.label, amount=i.amount
        )
        for i in prev.income_entries
        if i.is_recurring
    ]
    bills = [
        schemas.CarryForwardItem(
            source_type="bill",
            source_id=b.id,
            label=b.label,
            amount=b.amount,
            category=b.category,
        )
        for b in prev.bills
        if b.is_recurring
    ]
    return schemas.CarryForwardPreview(from_month=prev.month, income=income, bills=bills)


def apply_carry_forward(
    session: Session,
    new_month: models.BudgetMonth,
    overrides: list[schemas.CarryForwardOverride],
) -> None:
    """Insert recurring items from the previous month onto ``new_month``.

    ``overrides`` may amend an amount or exclude an item, keyed by the source
    entity's type and id. The caller is responsible for the surrounding commit.
    """
    prev = _previous_month(session, new_month.month)
    if prev is None:
        return

    income_overrides = {o.source_id: o for o in overrides if o.source_type == "income"}
    bill_overrides = {o.source_id: o for o in overrides if o.source_type == "bill"}

    for src in prev.income_entries:
        if not src.is_recurring:
            continue
        ov = income_overrides.get(src.id)
        if ov and ov.exclude:
            continue
        amount = ov.amount if ov and ov.amount is not None else src.amount
        session.add(
            models.IncomeEntry(
                month_id=new_month.id,
                label=src.label,
                amount=amount,
                is_recurring=True,
            )
        )

    for src in prev.bills:
        if not src.is_recurring:
            continue
        ov = bill_overrides.get(src.id)
        if ov and ov.exclude:
            continue
        amount = ov.amount if ov and ov.amount is not None else src.amount
        session.add(
            models.Bill(
                month_id=new_month.id,
                label=src.label,
                amount=amount,
                category=src.category,
                is_recurring=True,
                due_date=src.due_date,
            )
        )
