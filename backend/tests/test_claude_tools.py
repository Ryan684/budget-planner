"""Tool dispatch: current-month-only writes, source tagging, validation (FR-008/011/012/014)."""

import claude_tools
import models
import pytest

from tests.factories import make_bill, make_income, make_month


def test_add_bill_writes_with_claude_source_and_reason(db_session):
    month = make_month(db_session, month="2026-06")
    claude_tools.dispatch(
        db_session,
        month.id,
        "add_bill",
        {"label": "Water", "amount": 45.0, "category": "Utilities", "reason": "User asked"},
    )
    db_session.flush()
    bill = db_session.query(models.Bill).filter(models.Bill.label == "Water").one()
    assert bill.amount == 45.0 and bill.month_id == month.id
    amendment = (
        db_session.query(models.Amendment)
        .filter(models.Amendment.entity_type == "bill", models.Amendment.entity_id == bill.id)
        .one()
    )
    assert amendment.source == "claude"
    assert amendment.reason == "User asked"


def test_update_bill_in_current_month(db_session):
    month = make_month(db_session, month="2026-06")
    bill = make_bill(db_session, month.id, label="Electricity", amount=85.0)
    claude_tools.dispatch(
        db_session,
        month.id,
        "update_bill",
        {"bill_id": bill.id, "amount": 97.0, "reason": "Price rise"},
    )
    db_session.flush()
    db_session.refresh(bill)
    assert bill.amount == 97.0


def test_cannot_write_to_a_previous_month_bill(db_session):
    previous = make_month(db_session, month="2026-05")
    current = make_month(db_session, month="2026-06")
    old_bill = make_bill(db_session, previous.id, label="Old", amount=10.0)
    with pytest.raises(claude_tools.ToolDispatchError):
        claude_tools.dispatch(
            db_session,
            current.id,
            "update_bill",
            {"bill_id": old_bill.id, "amount": 20.0, "reason": "x"},
        )


def test_unknown_target_raises(db_session):
    month = make_month(db_session, month="2026-06")
    with pytest.raises(claude_tools.ToolDispatchError):
        claude_tools.dispatch(
            db_session,
            month.id,
            "update_bill",
            {"bill_id": 999, "amount": 20.0, "reason": "x"},
        )


def test_negative_amount_raises(db_session):
    month = make_month(db_session, month="2026-06")
    with pytest.raises(claude_tools.ToolDispatchError):
        claude_tools.dispatch(
            db_session,
            month.id,
            "add_bill",
            {"label": "Bad", "amount": -5.0, "category": "X", "reason": "x"},
        )


def test_missing_reason_raises(db_session):
    month = make_month(db_session, month="2026-06")
    with pytest.raises(claude_tools.ToolDispatchError):
        claude_tools.dispatch(
            db_session,
            month.id,
            "add_bill",
            {"label": "Water", "amount": 45.0, "category": "Utilities"},
        )


def test_no_current_month_raises(db_session):
    with pytest.raises(claude_tools.ToolDispatchError):
        claude_tools.dispatch(
            db_session,
            None,
            "add_income",
            {"label": "Salary", "amount": 100.0, "reason": "x"},
        )


def test_delete_income_in_current_month(db_session):
    month = make_month(db_session, month="2026-06")
    income = make_income(db_session, month.id, label="Bonus", amount=200.0)
    claude_tools.dispatch(
        db_session,
        month.id,
        "delete_income",
        {"income_id": income.id, "reason": "one-off removed"},
    )
    db_session.flush()
    assert db_session.get(models.IncomeEntry, income.id) is None
