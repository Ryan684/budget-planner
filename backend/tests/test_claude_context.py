"""The budget context payload: full picture in, secrets out (FR-002/022, SC-005)."""

import json
from datetime import date, timedelta

import claude_context
from config import settings

from tests.factories import (
    CURRENT_MONTH,
    PREVIOUS_MONTH,
    make_account,
    make_bill,
    make_income,
    make_month,
)


def test_context_includes_full_financial_picture(db_session):
    m1 = make_month(db_session, month=PREVIOUS_MONTH)
    m2 = make_month(db_session, month=CURRENT_MONTH)
    inc = make_income(db_session, m2.id, label="Salary", amount=3200.0)
    bill = make_bill(db_session, m2.id, label="Mortgage", amount=1100.0, category="Housing")
    acc = make_account(db_session, label="Savings", balance=8400.0, account_type="savings")

    ctx = claude_context.build_budget_context(db_session)

    assert ctx["current_month_id"] == m2.id
    assert [m["month"] for m in ctx["months"]] == [PREVIOUS_MONTH, CURRENT_MONTH]
    june = next(m for m in ctx["months"] if m["month"] == CURRENT_MONTH)
    assert june["id"] == m2.id
    assert june["summary"] == {
        "total_income": 3200.0,
        "total_bills": 1100.0,
        "monthly_surplus": 2100.0,
    }
    # Income entry — all fields
    assert june["income"][0]["id"] == inc.id
    assert june["income"][0]["label"] == "Salary"
    assert june["income"][0]["amount"] == 3200.0
    assert june["income"][0]["is_recurring"] is True
    # Bill entry — all fields
    assert june["bills"][0]["id"] == bill.id
    assert june["bills"][0]["label"] == "Mortgage"
    assert june["bills"][0]["amount"] == 1100.0
    assert june["bills"][0]["category"] == "Housing"
    assert june["bills"][0]["is_recurring"] is True
    # Account — all fields
    assert ctx["accounts"][0]["id"] == acc.id
    assert ctx["accounts"][0]["label"] == "Savings"
    assert ctx["accounts"][0]["balance"] == 8400.0
    assert ctx["accounts"][0]["account_type"] == "savings"
    assert "as_of_date" in ctx["accounts"][0]
    assert "is_stale" in ctx["accounts"][0]
    assert "amendments" in ctx and "balance_snapshots" in ctx
    _ = m1  # earlier month present for comparison


def test_context_flags_stale_balance(db_session):
    make_month(db_session, month=CURRENT_MONTH)
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
    make_month(db_session, month=CURRENT_MONTH)
    account_id = client.post("/api/accounts", json={"label": "Savings", "balance": 8000.0}).json()[
        "id"
    ]
    client.patch(f"/api/accounts/{account_id}", json={"balance": 8400.0})

    ctx = claude_context.build_budget_context(db_session)
    balances = [s["balance"] for s in ctx["balance_snapshots"] if s["account_id"] == account_id]
    assert balances == [8000.0, 8400.0]


def test_is_stale_boundary(db_session):
    make_month(db_session, month=CURRENT_MONTH)
    today = date.today()
    exactly_30 = today - timedelta(days=30)
    just_under = today - timedelta(days=29)
    make_account(db_session, label="Exactly 30", balance=100.0, as_of=exactly_30)
    make_account(db_session, label="Just under", balance=100.0, as_of=just_under)

    ctx = claude_context.build_budget_context(db_session)
    by_label = {a["label"]: a for a in ctx["accounts"]}
    assert by_label["Exactly 30"]["is_stale"] is True
    assert by_label["Just under"]["is_stale"] is False


def test_snapshot_ordering_by_date(client, db_session):
    make_month(db_session, month=CURRENT_MONTH)
    account_id = client.post("/api/accounts", json={"label": "Current", "balance": 1000.0}).json()[
        "id"
    ]
    client.patch(
        f"/api/accounts/{account_id}", json={"balance": 1100.0, "as_of_date": "2026-05-01"}
    )
    client.patch(
        f"/api/accounts/{account_id}", json={"balance": 1200.0, "as_of_date": "2026-06-01"}
    )

    ctx = claude_context.build_budget_context(db_session)
    dates = [s["as_of_date"] for s in ctx["balance_snapshots"] if s["account_id"] == account_id]
    assert dates == sorted(dates)


def test_context_snapshot_fields(client, db_session):
    make_month(db_session, month=CURRENT_MONTH)
    account_id = client.post("/api/accounts", json={"label": "Savings", "balance": 8000.0}).json()[
        "id"
    ]
    client.patch(f"/api/accounts/{account_id}", json={"balance": 8400.0})

    ctx = claude_context.build_budget_context(db_session)
    snap = next(s for s in ctx["balance_snapshots"] if s["account_id"] == account_id)
    assert "account_id" in snap
    assert "balance" in snap
    assert "as_of_date" in snap


def test_context_excludes_secrets(db_session, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-ant-SECRET-value")
    monkeypatch.setattr(settings, "app_pin", "4321")
    monkeypatch.setattr(settings, "database_url", "/mnt/usbssd/budget.db")
    make_month(db_session, month=CURRENT_MONTH)
    make_account(db_session, label="Savings", balance=8400.0)

    serialized = json.dumps(claude_context.build_budget_context(db_session))
    assert "sk-ant-SECRET-value" not in serialized
    assert "4321" not in serialized
    assert "/mnt/usbssd/budget.db" not in serialized
    # only the expected top-level keys are present
    ctx = claude_context.build_budget_context(db_session)
    assert set(ctx) == {"current_month_id", "months", "accounts", "balance_snapshots", "amendments"}
