"""Unit tests for pure budget calculation functions (budget.py)."""

import budget

from tests.factories import make_account, make_bill, make_income, make_month


def test_empty_month_all_zero(db_session):
    month = make_month(db_session)
    assert budget.total_income(db_session, month.id) == 0
    assert budget.total_bills(db_session, month.id) == 0
    assert budget.monthly_surplus(db_session, month.id) == 0


def test_income_and_bills_sum(db_session):
    month = make_month(db_session)
    make_income(db_session, month.id, amount=2450.0)
    make_income(db_session, month.id, amount=1860.0)
    make_bill(db_session, month.id, amount=1180.0)
    make_bill(db_session, month.id, amount=198.0)

    assert budget.total_income(db_session, month.id) == 4310.0
    assert budget.total_bills(db_session, month.id) == 1378.0
    assert budget.monthly_surplus(db_session, month.id) == 2932.0


def test_negative_surplus(db_session):
    month = make_month(db_session)
    make_income(db_session, month.id, amount=3000.0)
    make_bill(db_session, month.id, amount=3100.0)
    assert budget.monthly_surplus(db_session, month.id) == -100.0


def test_totals_scoped_per_month(db_session):
    m1 = make_month(db_session, month="2026-05")
    m2 = make_month(db_session, month="2026-06")
    make_income(db_session, m1.id, amount=1000.0)
    make_income(db_session, m2.id, amount=2000.0)
    assert budget.total_income(db_session, m1.id) == 1000.0
    assert budget.total_income(db_session, m2.id) == 2000.0


def test_total_balances_all_accounts(db_session):
    make_account(db_session, label="Joint current", balance=2300.0, account_type="current")
    make_account(db_session, label="Savings", balance=8400.0, account_type="savings")
    make_account(db_session, label="Ryan ISA", balance=12000.0, account_type="savings")
    assert budget.total_balances(db_session) == 22700.0


def test_total_savings_only_savings_accounts(db_session):
    make_account(db_session, label="Joint current", balance=2300.0, account_type="current")
    make_account(db_session, label="Savings", balance=8400.0, account_type="savings")
    make_account(db_session, label="Ryan ISA", balance=12000.0, account_type="savings")
    assert budget.total_savings(db_session) == 20400.0


def test_total_balances_empty(db_session):
    assert budget.total_balances(db_session) == 0
    assert budget.total_savings(db_session) == 0
