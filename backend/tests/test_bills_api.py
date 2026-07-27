"""API tests for bills endpoints."""

from tests.factories import CURRENT_MONTH, make_bill


def _create_month(client, month=CURRENT_MONTH):
    return client.post("/api/months", json={"month": month}).json()


def test_add_recurring_bill(client):
    month = _create_month(client)
    resp = client.post(
        f"/api/months/{month['id']}/bills",
        json={
            "label": "Mortgage",
            "amount": 1100.0,
            "category": "Housing",
            "is_recurring": True,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["category"] == "Housing"
    assert body["is_recurring"] is True


def test_add_one_off_bill(client):
    month = _create_month(client)
    resp = client.post(
        f"/api/months/{month['id']}/bills",
        json={"label": "Boiler service", "amount": 120.0, "category": "Home"},
    )
    assert resp.status_code == 201
    assert resp.json()["is_recurring"] is False


def test_bill_with_due_date(client):
    month = _create_month(client)
    resp = client.post(
        f"/api/months/{month['id']}/bills",
        json={"label": "Rent", "amount": 800.0, "category": "Housing", "due_date": 1},
    )
    assert resp.status_code == 201
    assert resp.json()["due_date"] == 1


def test_edit_bill_amount(client, db_session):
    month = _create_month(client)
    bill = make_bill(db_session, month["id"], label="Electricity", amount=85.0)
    resp = client.patch(f"/api/bills/{bill.id}", json={"amount": 97.0})
    assert resp.status_code == 200
    assert resp.json()["amount"] == 97.0


def test_delete_bill(client, db_session):
    month = _create_month(client)
    bill = make_bill(db_session, month["id"])
    resp = client.delete(f"/api/bills/{bill.id}")
    assert resp.status_code == 204


def test_list_bills(client, db_session):
    month = _create_month(client)
    make_bill(db_session, month["id"], label="A", category="Housing")
    make_bill(db_session, month["id"], label="B", category="Utilities")
    resp = client.get(f"/api/months/{month['id']}/bills")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_edit_missing_bill_404(client):
    assert client.patch("/api/bills/999", json={"amount": 1.0}).status_code == 404


def test_negative_amount_rejected(client):
    month = _create_month(client)
    resp = client.post(
        f"/api/months/{month['id']}/bills",
        json={"label": "Bad", "amount": -5.0, "category": "X"},
    )
    assert resp.status_code == 422


def test_due_date_out_of_range_rejected(client):
    month = _create_month(client)
    resp = client.post(
        f"/api/months/{month['id']}/bills",
        json={"label": "Bad", "amount": 5.0, "category": "X", "due_date": 32},
    )
    assert resp.status_code == 422


def test_add_bill_missing_month_404(client):
    resp = client.post(
        "/api/months/999/bills",
        json={"label": "X", "amount": 1.0, "category": "Y"},
    )
    assert resp.status_code == 404
