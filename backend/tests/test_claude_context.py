"""The budget context payload: full picture in, secrets out (FR-002/022, SC-005)."""

import json
from datetime import date, timedelta

import claude_context
from config import settings

from tests.factories import make_account, make_bill, make_income, make_month


def test_context_includes_full_financial_picture(db_session):
    m1 = make_month(db_session, month="2026-05")
    m2 = make_month(db_session, month="2026-06")
    make_income(db_session, m2.id, label="Salary", amount=3200.0)
    make_bill(db_session, m2.id, label="Mortgage", amount=1100.0, category="Housing")
    make_account(db_session, label="Savings", balance=8400.0, account_type="savings")

    ctx = claude_context.build_budget_context(db_session)

    assert ctx["current_month_id"] == m2.id
    assert [m["month"] for m in ctx["months"]] == ["2026-05", "2026-06"]
    june = next(m for m in ctx["months"] if m["month"] == "2026-06")
    assert june["summary"] == {
        "total_income": 3200.0,
        "total_bills": 1100.0,
        "monthly_surplus": 2100.0,
    }
    assert june["income"][0]["label"] == "Salary"
    assert june["bills"][0]["category"] == "Housing"
    assert ctx["accounts"][0]["label"] == "Savings"
    assert "amendments" in ctx and "balance_snapshots" in ctx
    _ = m1  # earlier month present for comparison


def test_context_flags_stale_balance(db_session):
    make_month(db_session, month="2026-06")
    fresh = date.today() - timedelta(days=5)
    stale = date.today() - timedelta(days=45)
    make_account(db_session, label="Current", balance=100.0, as_of=fresh)
    make_account(db_session, label="Old savings", balance=8400.0, as_of=stale)

    ctx = claude_context.build_budget_context(db_session)
    by_label = {a["label"]: a for a in ctx["accounts"]}
    assert by_label["Current"]["is_stale"] is False
    assert by_label["Old savings"]["is_stale"] is True
    assert by_label["Old savings"]["as_of_date"] == stale.isoformat()


def test_context_includes_balance_snapshots(client, db_session):
    make_month(db_session, month="2026-06")
    account_id = client.post("/api/accounts", json={"label": "Savings", "balance": 8000.0}).json()[
        "id"
    ]
    client.patch(f"/api/accounts/{account_id}", json={"balance": 8400.0})

    ctx = claude_context.build_budget_context(db_session)
    balances = [s["balance"] for s in ctx["balance_snapshots"] if s["account_id"] == account_id]
    assert balances == [8000.0, 8400.0]


def test_context_excludes_secrets(db_session, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-ant-SECRET-value")
    monkeypatch.setattr(settings, "app_pin", "4321")
    monkeypatch.setattr(settings, "database_url", "/mnt/usbssd/budget.db")
    make_month(db_session, month="2026-06")
    make_account(db_session, label="Savings", balance=8400.0)

    serialized = json.dumps(claude_context.build_budget_context(db_session))
    assert "sk-ant-SECRET-value" not in serialized
    assert "4321" not in serialized
    assert "/mnt/usbssd/budget.db" not in serialized
    # only the expected top-level keys are present
    ctx = claude_context.build_budget_context(db_session)
    assert set(ctx) == {"current_month_id", "months", "accounts", "balance_snapshots", "amendments"}
