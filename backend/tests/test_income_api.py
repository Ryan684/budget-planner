"""API tests for income endpoints."""

from tests.factories import make_income


def _create_month(client, month="2026-06"):
    return client.post("/api/months", json={"month": month}).json()


def test_add_income_entry(client):
    month = _create_month(client)
    resp = client.post(
        f"/api/months/{month['id']}/income",
        json={"label": "Freelance", "amount": 500.0, "is_recurring": False},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["label"] == "Freelance"
    assert body["amount"] == 500.0
    assert body["is_recurring"] is False


def test_add_recurring_income(client):
    month = _create_month(client)
    resp = client.post(
        f"/api/months/{month['id']}/income",
        json={"label": "Ryan salary", "amount": 3200.0, "is_recurring": True},
    )
    assert resp.status_code == 201
    assert resp.json()["is_recurring"] is True


def test_list_income(client, db_session):
    month = _create_month(client)
    make_income(db_session, month["id"], label="A", amount=1000.0)
    make_income(db_session, month["id"], label="B", amount=200.0)
    resp = client.get(f"/api/months/{month['id']}/income")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_edit_income(client, db_session):
    month = _create_month(client)
    income = make_income(db_session, month["id"], label="Ryan salary", amount=3200.0)
    resp = client.patch(f"/api/income/{income.id}", json={"amount": 3400.0})
    assert resp.status_code == 200
    assert resp.json()["amount"] == 3400.0


def test_delete_income(client, db_session):
    month = _create_month(client)
    income = make_income(db_session, month["id"])
    resp = client.delete(f"/api/income/{income.id}")
    assert resp.status_code == 204
    assert client.get(f"/api/months/{month['id']}/income").json() == []


def test_edit_missing_income_404(client):
    assert client.patch("/api/income/999", json={"amount": 1.0}).status_code == 404


def test_delete_missing_income_404(client):
    assert client.delete("/api/income/999").status_code == 404


def test_negative_amount_rejected(client):
    month = _create_month(client)
    resp = client.post(
        f"/api/months/{month['id']}/income",
        json={"label": "Bad", "amount": -5.0},
    )
    assert resp.status_code == 422


def test_add_income_missing_month_404(client):
    resp = client.post("/api/months/999/income", json={"label": "X", "amount": 1.0})
    assert resp.status_code == 404
