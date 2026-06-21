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


def test_add_income_writes_with_claude_source_and_reason(db_session):
    month = make_month(db_session, month="2026-06")
    claude_tools.dispatch(
        db_session,
        month.id,
        "add_income",
        {"label": "Freelance", "amount": 500.0, "reason": "Side project payment"},
    )
    db_session.flush()
    income = (
        db_session.query(models.IncomeEntry).filter(models.IncomeEntry.label == "Freelance").one()
    )
    assert income.amount == 500.0
    assert income.month_id == month.id
    amendment = (
        db_session.query(models.Amendment)
        .filter(models.Amendment.entity_type == "income", models.Amendment.entity_id == income.id)
        .one()
    )
    assert amendment.source == "claude"
    assert amendment.reason == "Side project payment"


def test_update_income_in_current_month(db_session):
    month = make_month(db_session, month="2026-06")
    income = make_income(db_session, month.id, label="Salary", amount=3000.0)
    claude_tools.dispatch(
        db_session,
        month.id,
        "update_income",
        {"income_id": income.id, "amount": 3200.0, "reason": "Pay rise"},
    )
    db_session.flush()
    db_session.refresh(income)
    assert income.amount == 3200.0
    amendment = (
        db_session.query(models.Amendment)
        .filter(
            models.Amendment.entity_type == "income",
            models.Amendment.entity_id == income.id,
            models.Amendment.field_changed == "amount",
        )
        .one()
    )
    assert amendment.source == "claude"
    assert amendment.old_value == "3000.0"
    assert amendment.new_value == "3200.0"


def test_cannot_update_income_from_previous_month(db_session):
    previous = make_month(db_session, month="2026-05")
    current = make_month(db_session, month="2026-06")
    old_income = make_income(db_session, previous.id, label="Old salary", amount=3000.0)
    with pytest.raises(claude_tools.ToolDispatchError):
        claude_tools.dispatch(
            db_session,
            current.id,
            "update_income",
            {"income_id": old_income.id, "amount": 3100.0, "reason": "x"},
        )


def test_delete_bill_in_current_month(db_session):
    month = make_month(db_session, month="2026-06")
    bill = make_bill(db_session, month.id, label="Netflix", amount=18.0)
    bill_id = bill.id
    claude_tools.dispatch(
        db_session,
        month.id,
        "delete_bill",
        {"bill_id": bill_id, "reason": "Subscription cancelled"},
    )
    db_session.flush()
    assert db_session.get(models.Bill, bill_id) is None
    amendment = (
        db_session.query(models.Amendment)
        .filter(
            models.Amendment.entity_type == "bill",
            models.Amendment.entity_id == bill_id,
            models.Amendment.field_changed == "deleted",
        )
        .one()
    )
    assert amendment.source == "claude"
    assert amendment.reason == "Subscription cancelled"
    assert amendment.month_id == month.id


def test_update_account_balance_tool(db_session):
    month = make_month(db_session, month="2026-06")
    from tests.factories import make_account

    account = make_account(db_session, label="ISA", balance=5000.0)
    claude_tools.dispatch(
        db_session,
        month.id,
        "update_account_balance",
        {"account_id": account.id, "balance": 5500.0, "reason": "Monthly top-up"},
    )
    db_session.flush()
    db_session.refresh(account)
    assert account.balance == 5500.0
    amendment = (
        db_session.query(models.Amendment)
        .filter(
            models.Amendment.entity_type == "account_balance",
            models.Amendment.entity_id == account.id,
            models.Amendment.field_changed == "balance",
        )
        .one()
    )
    assert amendment.source == "claude"
    assert amendment.reason == "Monthly top-up"
    assert amendment.month_id == month.id
    assert amendment.old_value == "5000.0"
    assert amendment.new_value == "5500.0"
