"""API tests for month endpoints, summary, and detail."""

from tests.factories import make_bill, make_income, make_month


def test_create_first_month_blank(client):
    resp = client.post("/api/months", json={"month": "2026-06"})
    assert resp.status_code == 201
    assert resp.json()["month"] == "2026-06"


def test_create_duplicate_month_409(client):
    client.post("/api/months", json={"month": "2026-06"})
    resp = client.post("/api/months", json={"month": "2026-06"})
    assert resp.status_code == 409


def test_invalid_month_format_422(client):
    assert client.post("/api/months", json={"month": "June"}).status_code == 422


def test_list_months(client):
    client.post("/api/months", json={"month": "2026-05"})
    client.post("/api/months", json={"month": "2026-06"})
    resp = client.get("/api/months")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_month(client):
    created = client.post("/api/months", json={"month": "2026-06"}).json()
    resp = client.get(f"/api/months/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["month"] == "2026-06"


def test_get_missing_month_404(client):
    assert client.get("/api/months/999").status_code == 404


def test_update_month_notes(client):
    created = client.post("/api/months", json={"month": "2026-06"}).json()
    resp = client.patch(f"/api/months/{created['id']}", json={"notes": "tight month"})
    assert resp.status_code == 200
    assert resp.json()["notes"] == "tight month"


def test_summary_empty_month_all_zero(client):
    created = client.post("/api/months", json={"month": "2026-06"}).json()
    resp = client.get(f"/api/months/{created['id']}/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_income"] == 0
    assert body["total_bills"] == 0
    assert body["monthly_surplus"] == 0


def test_summary_computes_surplus(client, db_session):
    month = make_month(db_session, month="2026-06")
    make_income(db_session, month.id, amount=4310.0)
    make_bill(db_session, month.id, amount=1378.0)
    resp = client.get(f"/api/months/{month.id}/summary")
    body = resp.json()
    assert body["total_income"] == 4310.0
    assert body["total_bills"] == 1378.0
    assert body["monthly_surplus"] == 2932.0


def test_summary_negative_surplus(client, db_session):
    month = make_month(db_session, month="2026-06")
    make_income(db_session, month.id, amount=3000.0)
    make_bill(db_session, month.id, amount=3100.0)
    body = client.get(f"/api/months/{month.id}/summary").json()
    assert body["monthly_surplus"] == -100.0


def test_detail_returns_income_bills_summary(client, db_session):
    month = make_month(db_session, month="2026-06")
    make_income(db_session, month.id, amount=1000.0)
    make_bill(db_session, month.id, amount=400.0)
    resp = client.get(f"/api/months/{month.id}/detail")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["income"]) == 1
    assert len(body["bills"]) == 1
    assert body["summary"]["monthly_surplus"] == 600.0


def test_carry_forward_preview_no_previous_month(client):
    resp = client.get("/api/months/carry-forward-preview", params={"month": "2026-06"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["from_month"] is None
    assert body["income"] == []
    assert body["bills"] == []
