"""API tests for the amendments log read endpoint."""

import crud

from tests.factories import CURRENT_MONTH, PREVIOUS_MONTH, make_bill, make_month


def test_amendments_listed_per_month(client, db_session):
    month = make_month(db_session, month=CURRENT_MONTH)
    bill = make_bill(db_session, month.id, label="Electricity", amount=85.0)
    client.patch(f"/api/bills/{bill.id}", json={"amount": 97.0})

    resp = client.get(f"/api/months/{month.id}/amendments")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    entry = body[0]
    assert entry["source"] == "user"
    assert entry["field_changed"] == "amount"
    assert entry["old_value"] == "85.0"
    assert entry["new_value"] == "97.0"
    assert "amended_at" in entry


def test_amendments_newest_first(client, db_session):
    month = make_month(db_session, month=CURRENT_MONTH)
    bill = make_bill(db_session, month.id, amount=85.0)
    client.patch(f"/api/bills/{bill.id}", json={"amount": 90.0})
    client.patch(f"/api/bills/{bill.id}", json={"amount": 95.0})

    body = client.get(f"/api/months/{month.id}/amendments").json()
    assert len(body) == 2
    assert body[0]["new_value"] == "95.0"
    assert body[1]["new_value"] == "90.0"


def test_amendments_scoped_to_month(client, db_session):
    m1 = make_month(db_session, month=PREVIOUS_MONTH)
    m2 = make_month(db_session, month=CURRENT_MONTH)
    b1 = make_bill(db_session, m1.id, amount=10.0)
    b2 = make_bill(db_session, m2.id, amount=20.0)
    # The previous month is read-only over HTTP (Phase 5), so its amendment is
    # seeded directly — the point here is that the listing filters by month.
    crud.update_entity(db_session, b1, {"amount": 11.0}, entity_type="bill", month_id=m1.id)
    client.patch(f"/api/bills/{b2.id}", json={"amount": 22.0})

    assert len(client.get(f"/api/months/{m1.id}/amendments").json()) == 1
    assert len(client.get(f"/api/months/{m2.id}/amendments").json()) == 1


def test_amendments_missing_month_404(client):
    assert client.get("/api/months/999/amendments").status_code == 404
