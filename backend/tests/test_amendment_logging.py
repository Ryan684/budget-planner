"""Tests for the centralized create/update/delete + amendment-logging helper."""

import crud
import models

from tests.factories import make_account, make_bill, make_income, make_month


def _amendments(session):
    return session.query(models.Amendment).order_by(models.Amendment.id).all()


def test_create_logs_amendment(db_session):
    month = make_month(db_session)
    bill = models.Bill(month_id=month.id, label="Mortgage", amount=1100.0, category="Housing")
    crud.create_entity(db_session, bill, entity_type="bill", month_id=month.id)

    logs = _amendments(db_session)
    assert len(logs) == 1
    assert logs[0].entity_type == "bill"
    assert logs[0].entity_id == bill.id
    assert logs[0].field_changed == "created"
    assert logs[0].old_value is None
    assert logs[0].new_value == str(bill.id)
    assert logs[0].reason is None
    assert logs[0].source == "user"
    assert logs[0].month_id == month.id


def test_update_logs_per_field_with_old_and_new(db_session):
    month = make_month(db_session)
    bill = make_bill(db_session, month.id, label="Electricity", amount=85.0)

    crud.update_entity(db_session, bill, {"amount": 97.0}, entity_type="bill", month_id=month.id)

    logs = _amendments(db_session)
    assert len(logs) == 1
    assert logs[0].field_changed == "amount"
    assert logs[0].old_value == "85.0"
    assert logs[0].new_value == "97.0"
    assert logs[0].source == "user"
    assert bill.amount == 97.0


def test_update_no_change_logs_nothing(db_session):
    month = make_month(db_session)
    bill = make_bill(db_session, month.id, amount=85.0)
    crud.update_entity(db_session, bill, {"amount": 85.0}, entity_type="bill", month_id=month.id)
    assert _amendments(db_session) == []


def test_update_skips_unchanged_field_but_logs_changed_one(db_session):
    """A None/unchanged field must `continue` (not stop) so later fields log."""
    month = make_month(db_session)
    bill = make_bill(db_session, month.id, label="Electricity", amount=85.0)
    # amount is unchanged (skipped), label changes (must still be logged).
    crud.update_entity(
        db_session,
        bill,
        {"amount": 85.0, "label": "Power"},
        entity_type="bill",
        month_id=month.id,
    )
    logs = _amendments(db_session)
    assert [m.field_changed for m in logs] == ["label"]
    assert logs[0].old_value == "Electricity"
    assert logs[0].new_value == "Power"
    assert logs[0].source == "user"


def test_update_none_value_skipped_then_real_change_logged(db_session):
    """A None value is skipped via `continue`; a following real change logs."""
    month = make_month(db_session)
    bill = make_bill(db_session, month.id, label="Electricity", amount=85.0)
    crud.update_entity(
        db_session,
        bill,
        {"category": None, "amount": 97.0},
        entity_type="bill",
        month_id=month.id,
    )
    logs = _amendments(db_session)
    assert [m.field_changed for m in logs] == ["amount"]


def test_delete_logs_and_removes_row(db_session):
    month = make_month(db_session)
    bill = make_bill(db_session, month.id, label="Boiler", amount=120.0)
    bill_id = bill.id

    crud.delete_entity(db_session, bill, entity_type="bill", month_id=month.id)

    logs = _amendments(db_session)
    assert len(logs) == 1
    assert logs[0].field_changed == "deleted"
    assert logs[0].old_value == str(bill_id)
    assert logs[0].new_value is None
    assert logs[0].entity_id == bill_id
    assert logs[0].month_id == month.id
    assert logs[0].source == "user"
    # Entity is gone but the amendment (audit trail) remains.
    assert db_session.get(models.Bill, bill_id) is None


def test_income_update_logged(db_session):
    month = make_month(db_session)
    income = make_income(db_session, month.id, label="Ryan salary", amount=3200.0)
    crud.update_entity(
        db_session, income, {"amount": 3400.0}, entity_type="income", month_id=month.id
    )
    logs = _amendments(db_session)
    assert logs[0].entity_type == "income"
    assert logs[0].old_value == "3200.0"
    assert logs[0].new_value == "3400.0"


def test_account_amendment_records_active_month(db_session):
    month = make_month(db_session, month="2026-06")
    account = make_account(db_session, label="Savings", balance=8400.0)
    crud.update_entity(
        db_session,
        account,
        {"balance": 8900.0},
        entity_type="account_balance",
        month_id=month.id,
    )
    logs = _amendments(db_session)
    assert logs[0].entity_type == "account_balance"
    assert logs[0].month_id == month.id
    assert logs[0].old_value == "8400.0"
    assert logs[0].new_value == "8900.0"


def test_claude_source_and_reason_passthrough(db_session):
    """The helper takes source/reason params so Phase 3 reuses it unchanged."""
    month = make_month(db_session)
    bill = make_bill(db_session, month.id, amount=85.0)
    crud.update_entity(
        db_session,
        bill,
        {"amount": 97.0},
        entity_type="bill",
        month_id=month.id,
        source="claude",
        reason="User asked to bump electricity",
    )
    logs = _amendments(db_session)
    assert logs[0].source == "claude"
    assert logs[0].reason == "User asked to bump electricity"
