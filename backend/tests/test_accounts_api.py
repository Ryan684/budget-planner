"""API tests for account balance endpoints (not month-scoped)."""

import models

from tests.factories import make_account, make_month


def test_add_account(client):
    resp = client.post(
        "/api/accounts",
        json={"label": "Joint current", "balance": 2300.0, "account_type": "current"},
    )
    assert resp.status_code == 201
    assert resp.json()["label"] == "Joint current"


def test_list_accounts_with_totals(client, db_session):
    make_account(db_session, label="Joint current", balance=2300.0, account_type="current")
    make_account(db_session, label="Savings", balance=8400.0, account_type="savings")
    make_account(db_session, label="Ryan ISA", balance=12000.0, account_type="savings")
    resp = client.get("/api/accounts")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["accounts"]) == 3
    assert body["total_balances"] == 22700.0
    assert body["total_savings"] == 20400.0


def test_edit_account_balance(client, db_session):
    account = make_account(db_session, label="Savings", balance=8400.0)
    resp = client.patch(f"/api/accounts/{account.id}", json={"balance": 8900.0})
    assert resp.status_code == 200
    assert resp.json()["balance"] == 8900.0


def test_edit_account_updates_as_of_date(client, db_session):
    account = make_account(db_session, label="Joint", balance=100.0)
    resp = client.patch(
        f"/api/accounts/{account.id}",
        json={"balance": 200.0, "as_of_date": "2026-05-30"},
    )
    assert resp.status_code == 200
    assert resp.json()["as_of_date"] == "2026-05-30"


def test_account_read_includes_as_of_date(client, db_session):
    make_account(db_session, label="Joint", balance=100.0)
    body = client.get("/api/accounts").json()
    assert "as_of_date" in body["accounts"][0]


def test_delete_account(client, db_session):
    account = make_account(db_session)
    resp = client.delete(f"/api/accounts/{account.id}")
    assert resp.status_code == 204
    assert client.get("/api/accounts").json()["accounts"] == []


def test_edit_missing_account_404(client):
    assert client.patch("/api/accounts/999", json={"balance": 1.0}).status_code == 404


def test_negative_balance_rejected(client):
    resp = client.post("/api/accounts", json={"label": "Bad", "balance": -1.0})
    assert resp.status_code == 422


def test_account_amendment_records_active_month(client, db_session):
    month = make_month(db_session, month="2026-06")
    account = make_account(db_session, label="Savings", balance=8400.0)
    client.patch(
        f"/api/accounts/{account.id}",
        json={"balance": 8900.0, "active_month_id": month.id},
    )
    amendment = (
        db_session.query(models.Amendment)
        .filter(models.Amendment.entity_type == "account_balance")
        .one()
    )
    assert amendment.month_id == month.id


def test_account_amendment_defaults_to_latest_month(client, db_session):
    make_month(db_session, month="2026-05")
    latest = make_month(db_session, month="2026-06")
    account = make_account(db_session, label="Savings", balance=8400.0)
    client.patch(f"/api/accounts/{account.id}", json={"balance": 8900.0})
    amendment = (
        db_session.query(models.Amendment)
        .filter(models.Amendment.entity_type == "account_balance")
        .one()
    )
    assert amendment.month_id == latest.id
