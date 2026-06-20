"""Tool definitions and dispatch for Claude writes.

Claude can add/edit/delete bills and income and update account balances — but
ONLY for the active current month. No tool accepts a ``month_id``: the current
month is resolved server-side, so a write to any other month is not even
expressible (FR-014). Every write goes through ``crud`` with ``source="claude"``
and a populated ``reason``, and with ``commit=False`` so the whole turn shares
one transaction and can be rolled back atomically (FR-015).

A problem Claude should hear about (missing target, wrong month, negative amount)
is raised as ``ToolDispatchError``; the client loop returns it to Claude as a
tool error so Claude can ask/explain, and the turn is rolled back.
"""

from typing import Any

import crud
import models
from sqlalchemy.orm import Session

ENTITY_MODEL = {"bill": models.Bill, "income": models.IncomeEntry}


class ToolDispatchError(Exception):
    """A write could not be applied; the message is surfaced back to Claude."""


def _require_reason(tool_input: dict) -> str:
    reason = tool_input.get("reason")
    if not reason:
        raise ToolDispatchError("A reason is required for every change.")
    return reason


def _require_current_month(current_month_id: int | None) -> int:
    if current_month_id is None:
        raise ToolDispatchError("There is no current month to write to.")
    return current_month_id


def _load_month_scoped(session: Session, entity_type: str, entity_id: int, current_month_id: int):
    model = ENTITY_MODEL[entity_type]
    entity = session.get(model, entity_id)
    if entity is None:
        raise ToolDispatchError(f"No {entity_type} with id {entity_id} exists.")
    if entity.month_id != current_month_id:
        raise ToolDispatchError(
            f"That {entity_type} is not in the current month and cannot be changed."
        )
    return entity


def _check_amount(value: Any, field: str = "amount") -> None:
    if value is not None and value < 0:
        raise ToolDispatchError(
            f"A negative {field} ({value}) was requested — please confirm the intended value."
        )


def _changes(tool_input: dict, fields: list[str]) -> dict:
    return {f: tool_input[f] for f in fields if f in tool_input and tool_input[f] is not None}


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
def dispatch(session: Session, current_month_id: int | None, name: str, tool_input: dict) -> str:
    """Execute one tool call inside the caller's transaction. Returns a short
    confirmation string for Claude; raises ToolDispatchError on any problem."""
    handler = _HANDLERS.get(name)
    if handler is None:
        raise ToolDispatchError(f"Unknown tool '{name}'.")
    return handler(session, current_month_id, tool_input)


def _add_bill(session, current_month_id, ti):
    month_id = _require_current_month(current_month_id)
    reason = _require_reason(ti)
    _check_amount(ti.get("amount"))
    bill = models.Bill(
        month_id=month_id,
        label=ti["label"],
        amount=ti["amount"],
        category=ti["category"],
        is_recurring=ti.get("is_recurring", False),
        due_date=ti.get("due_date"),
    )
    crud.create_entity(
        session,
        bill,
        entity_type="bill",
        month_id=month_id,
        source="claude",
        reason=reason,
        commit=False,
    )
    return f"Added bill '{bill.label}' (£{bill.amount:.2f})."


def _update_bill(session, current_month_id, ti):
    month_id = _require_current_month(current_month_id)
    reason = _require_reason(ti)
    _check_amount(ti.get("amount"))
    bill = _load_month_scoped(session, "bill", ti["bill_id"], month_id)
    changes = _changes(ti, ["label", "amount", "category", "is_recurring", "due_date"])
    crud.update_entity(
        session,
        bill,
        changes,
        entity_type="bill",
        month_id=month_id,
        source="claude",
        reason=reason,
        commit=False,
    )
    return f"Updated bill '{bill.label}'."


def _delete_bill(session, current_month_id, ti):
    month_id = _require_current_month(current_month_id)
    reason = _require_reason(ti)
    bill = _load_month_scoped(session, "bill", ti["bill_id"], month_id)
    label = bill.label
    crud.delete_entity(
        session,
        bill,
        entity_type="bill",
        month_id=month_id,
        source="claude",
        reason=reason,
        commit=False,
    )
    return f"Deleted bill '{label}'."


def _add_income(session, current_month_id, ti):
    month_id = _require_current_month(current_month_id)
    reason = _require_reason(ti)
    _check_amount(ti.get("amount"))
    income = models.IncomeEntry(
        month_id=month_id,
        label=ti["label"],
        amount=ti["amount"],
        is_recurring=ti.get("is_recurring", False),
    )
    crud.create_entity(
        session,
        income,
        entity_type="income",
        month_id=month_id,
        source="claude",
        reason=reason,
        commit=False,
    )
    return f"Added income '{income.label}' (£{income.amount:.2f})."


def _update_income(session, current_month_id, ti):
    month_id = _require_current_month(current_month_id)
    reason = _require_reason(ti)
    _check_amount(ti.get("amount"))
    income = _load_month_scoped(session, "income", ti["income_id"], month_id)
    changes = _changes(ti, ["label", "amount", "is_recurring"])
    crud.update_entity(
        session,
        income,
        changes,
        entity_type="income",
        month_id=month_id,
        source="claude",
        reason=reason,
        commit=False,
    )
    return f"Updated income '{income.label}'."


def _delete_income(session, current_month_id, ti):
    month_id = _require_current_month(current_month_id)
    reason = _require_reason(ti)
    income = _load_month_scoped(session, "income", ti["income_id"], month_id)
    label = income.label
    crud.delete_entity(
        session,
        income,
        entity_type="income",
        month_id=month_id,
        source="claude",
        reason=reason,
        commit=False,
    )
    return f"Deleted income '{label}'."


def _update_account_balance(session, current_month_id, ti):
    reason = _require_reason(ti)
    _check_amount(ti.get("balance"), field="balance")
    account = session.get(models.AccountBalance, ti["account_id"])
    if account is None:
        raise ToolDispatchError(f"No account with id {ti['account_id']} exists.")
    changes: dict[str, Any] = {"balance": ti["balance"]}
    if ti.get("as_of_date") is not None:
        from datetime import date

        changes["as_of_date"] = date.fromisoformat(ti["as_of_date"])
    # account balance amendments are stamped against the active (latest) month
    crud.update_entity(
        session,
        account,
        changes,
        entity_type="account_balance",
        month_id=current_month_id,
        source="claude",
        reason=reason,
        commit=False,
    )
    return f"Updated balance of '{account.label}' to £{account.balance:.2f}."


_HANDLERS = {
    "add_bill": _add_bill,
    "update_bill": _update_bill,
    "delete_bill": _delete_bill,
    "add_income": _add_income,
    "update_income": _update_income,
    "delete_income": _delete_income,
    "update_account_balance": _update_account_balance,
}


# ---------------------------------------------------------------------------
# Anthropic tool schemas (no month_id is ever exposed)
# ---------------------------------------------------------------------------
_REASON = {"type": "string", "description": "Human-readable reason for the change."}

TOOLS = [
    {
        "name": "add_bill",
        "description": "Add a bill to the current month.",
        "input_schema": {
            "type": "object",
            "properties": {
                "label": {"type": "string"},
                "amount": {"type": "number"},
                "category": {"type": "string"},
                "is_recurring": {"type": "boolean"},
                "due_date": {"type": "integer", "description": "Day of month 1-31."},
                "reason": _REASON,
            },
            "required": ["label", "amount", "category", "reason"],
        },
    },
    {
        "name": "update_bill",
        "description": "Update an existing bill in the current month.",
        "input_schema": {
            "type": "object",
            "properties": {
                "bill_id": {"type": "integer"},
                "label": {"type": "string"},
                "amount": {"type": "number"},
                "category": {"type": "string"},
                "is_recurring": {"type": "boolean"},
                "due_date": {"type": "integer"},
                "reason": _REASON,
            },
            "required": ["bill_id", "reason"],
        },
    },
    {
        "name": "delete_bill",
        "description": "Delete a bill from the current month.",
        "input_schema": {
            "type": "object",
            "properties": {"bill_id": {"type": "integer"}, "reason": _REASON},
            "required": ["bill_id", "reason"],
        },
    },
    {
        "name": "add_income",
        "description": "Add an income entry to the current month.",
        "input_schema": {
            "type": "object",
            "properties": {
                "label": {"type": "string"},
                "amount": {"type": "number"},
                "is_recurring": {"type": "boolean"},
                "reason": _REASON,
            },
            "required": ["label", "amount", "reason"],
        },
    },
    {
        "name": "update_income",
        "description": "Update an existing income entry in the current month.",
        "input_schema": {
            "type": "object",
            "properties": {
                "income_id": {"type": "integer"},
                "label": {"type": "string"},
                "amount": {"type": "number"},
                "is_recurring": {"type": "boolean"},
                "reason": _REASON,
            },
            "required": ["income_id", "reason"],
        },
    },
    {
        "name": "delete_income",
        "description": "Delete an income entry from the current month.",
        "input_schema": {
            "type": "object",
            "properties": {"income_id": {"type": "integer"}, "reason": _REASON},
            "required": ["income_id", "reason"],
        },
    },
    {
        "name": "update_account_balance",
        "description": "Update an account balance. Writes an append-only snapshot.",
        "input_schema": {
            "type": "object",
            "properties": {
                "account_id": {"type": "integer"},
                "balance": {"type": "number"},
                "as_of_date": {"type": "string", "description": "ISO date YYYY-MM-DD."},
                "reason": _REASON,
            },
            "required": ["account_id", "balance", "reason"],
        },
    },
]
