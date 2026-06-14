"""Pydantic v2 request/response schemas.

Monetary fields are plain floats (GBP, stored as REAL). The ``£X,XXX.XX``
formatting is a frontend concern.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MONTH_PATTERN = r"^\d{4}-\d{2}$"

AccountType = Literal["current", "savings"]
EntityType = Literal["bill", "income", "account_balance"]
Source = Literal["user", "claude"]


# ---------------------------------------------------------------------------
# Income
# ---------------------------------------------------------------------------
class IncomeCreate(BaseModel):
    label: str
    amount: float = Field(ge=0)
    is_recurring: bool = False


class IncomeUpdate(BaseModel):
    label: str | None = None
    amount: float | None = Field(default=None, ge=0)
    is_recurring: bool | None = None


class IncomeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    month_id: int
    label: str
    amount: float
    is_recurring: bool


# ---------------------------------------------------------------------------
# Bills
# ---------------------------------------------------------------------------
class BillCreate(BaseModel):
    label: str
    amount: float = Field(ge=0)
    category: str
    is_recurring: bool = False
    due_date: int | None = Field(default=None, ge=1, le=31)


class BillUpdate(BaseModel):
    label: str | None = None
    amount: float | None = Field(default=None, ge=0)
    category: str | None = None
    is_recurring: bool | None = None
    due_date: int | None = Field(default=None, ge=1, le=31)


class BillRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    month_id: int
    label: str
    amount: float
    category: str
    is_recurring: bool
    due_date: int | None


# ---------------------------------------------------------------------------
# Account balances
# ---------------------------------------------------------------------------
class AccountCreate(BaseModel):
    label: str
    balance: float = Field(ge=0)
    account_type: AccountType = "current"
    as_of_date: date | None = None
    notes: str | None = None
    active_month_id: int | None = None


class AccountUpdate(BaseModel):
    label: str | None = None
    balance: float | None = Field(default=None, ge=0)
    account_type: AccountType | None = None
    as_of_date: date | None = None
    notes: str | None = None
    active_month_id: int | None = None


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    balance: float
    account_type: AccountType
    as_of_date: date
    notes: str | None


class AccountList(BaseModel):
    accounts: list[AccountRead]
    total_balances: float
    total_savings: float


# ---------------------------------------------------------------------------
# Months
# ---------------------------------------------------------------------------
class CarryForwardOverride(BaseModel):
    source_type: Literal["income", "bill"]
    source_id: int
    amount: float | None = Field(default=None, ge=0)
    exclude: bool = False


class MonthCreate(BaseModel):
    month: str = Field(pattern=MONTH_PATTERN)
    notes: str | None = None
    carry_forward: bool = False
    overrides: list[CarryForwardOverride] = Field(default_factory=list)


class MonthUpdate(BaseModel):
    notes: str | None = None


class MonthRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    month: str
    notes: str | None
    created_at: datetime
    updated_at: datetime


class BudgetSummary(BaseModel):
    month_id: int
    month: str
    total_income: float
    total_bills: float
    monthly_surplus: float
    total_balances: float
    total_savings: float


class MonthDetail(BaseModel):
    month: MonthRead
    income: list[IncomeRead]
    bills: list[BillRead]
    summary: BudgetSummary


class CarryForwardItem(BaseModel):
    source_type: Literal["income", "bill"]
    source_id: int
    label: str
    amount: float
    category: str | None = None


class CarryForwardPreview(BaseModel):
    from_month: str | None
    income: list[CarryForwardItem]
    bills: list[CarryForwardItem]


# ---------------------------------------------------------------------------
# Amendments
# ---------------------------------------------------------------------------
class AmendmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    month_id: int | None
    entity_type: EntityType
    entity_id: int
    entity_label: str | None
    field_changed: str
    old_value: str | None
    new_value: str | None
    reason: str | None
    source: Source
    amended_at: datetime
