"""SQLAlchemy ORM models for the Family Budget Planner data layer.

All monetary values are stored as Float (SQLite REAL) and displayed in GBP.
All timestamps are stored timezone-aware in UTC.
"""

from datetime import UTC, date, datetime

from database import Base
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    return datetime.now(UTC)


class BudgetMonth(Base):
    __tablename__ = "budget_months"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    month: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    income_entries: Mapped[list["IncomeEntry"]] = relationship(  # noqa: UP037 (forward ref)
        back_populates="month", cascade="all, delete-orphan"
    )
    bills: Mapped[list["Bill"]] = relationship(  # noqa: UP037 (forward ref)
        back_populates="month", cascade="all, delete-orphan"
    )


class IncomeEntry(Base):
    __tablename__ = "income_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    month_id: Mapped[int] = mapped_column(
        ForeignKey("budget_months.id"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    month: Mapped[BudgetMonth] = relationship(back_populates="income_entries")


class Bill(Base):
    __tablename__ = "bills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    month_id: Mapped[int] = mapped_column(
        ForeignKey("budget_months.id"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    due_date: Mapped[int | None] = mapped_column(Integer, nullable=True)

    month: Mapped[BudgetMonth] = relationship(back_populates="bills")


class AccountBalance(Base):
    """Not month-scoped — persistent records updated in place."""

    __tablename__ = "account_balances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String, nullable=False)
    balance: Mapped[float] = mapped_column(Float, nullable=False)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    account_type: Mapped[str] = mapped_column(String, nullable=False, default="current")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Amendment(Base):
    """Append-only audit log. Rows are never updated or deleted.

    ``entity_id`` is a plain integer, not an enforced FK, so deleting the
    underlying entity preserves the audit trail.
    """

    __tablename__ = "amendments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    month_id: Mapped[int | None] = mapped_column(
        ForeignKey("budget_months.id"), nullable=True, index=True
    )
    entity_type: Mapped[str] = mapped_column(String, nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    entity_label: Mapped[str | None] = mapped_column(String, nullable=True)
    field_changed: Mapped[str] = mapped_column(String, nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False, default="user")
    amended_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
