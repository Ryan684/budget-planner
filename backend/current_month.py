"""The single definition of "the current month" (Phase 5, US2).

The current month is the ``BudgetMonth`` whose ``month`` (``YYYY-MM``) equals the
current **local** calendar month — not the most recent month on file. Every write
path resolves it here (the UI editable month, the income/bills read-only guard,
and Claude's write target) so they cannot drift apart.

Local time, not UTC: "this month" is a local human concept, and UTC would flip
the current month up to an hour early or late around a month boundary. The
Constitution's "timestamps stored UTC" rule governs *stored* timestamps; this is
an interaction concern. ``today`` is injectable so tests need not touch the clock.
"""

from datetime import date

import models
from sqlalchemy import select
from sqlalchemy.orm import Session


def month_key(today: date | None = None) -> str:
    """The ``YYYY-MM`` key of the current local calendar month."""
    return (today or date.today()).strftime("%Y-%m")


def current_month(session: Session, *, today: date | None = None) -> models.BudgetMonth | None:
    """The budget month for the current calendar month, or None if not created yet."""
    return session.scalar(
        select(models.BudgetMonth).where(models.BudgetMonth.month == month_key(today))
    )


def current_month_id(session: Session, *, today: date | None = None) -> int | None:
    """The id of the current calendar month, or None if that month does not exist."""
    return session.scalar(
        select(models.BudgetMonth.id).where(models.BudgetMonth.month == month_key(today))
    )
