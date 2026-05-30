"""Tests for month carry-forward (preview + create with overrides)."""

from tests.factories import make_account, make_bill, make_income, make_month


def _seed_previous(db_session, month="2026-05"):
    prev = make_month(db_session, month=month)
    make_income(db_session, prev.id, label="Salary", amount=3000.0, is_recurring=True)
    make_income(db_session, prev.id, label="Bonus", amount=500.0, is_recurring=False)
    make_bill(
        db_session,
        prev.id,
        label="Mortgage",
        amount=1100.0,
        category="Housing",
        is_recurring=True,
        due_date=1,
    )
    make_bill(db_session, prev.id, label="Boiler", amount=120.0, is_recurring=False)
    return prev


def test_preview_returns_recurring_only(client, db_session):
    _seed_previous(db_session)
    resp = client.get("/api/months/carry-forward-preview", params={"month": "2026-06"})
    body = resp.json()
    assert body["from_month"] == "2026-05"
    assert [i["label"] for i in body["income"]] == ["Salary"]
    assert [b["label"] for b in body["bills"]] == ["Mortgage"]


def test_create_with_carry_forward_copies_recurring(client, db_session):
    _seed_previous(db_session)
    resp = client.post("/api/months", json={"month": "2026-06", "carry_forward": True})
    assert resp.status_code == 201
    new_id = resp.json()["id"]

    income = client.get(f"/api/months/{new_id}/income").json()
    bills = client.get(f"/api/months/{new_id}/bills").json()
    assert [i["label"] for i in income] == ["Salary"]
    assert [b["label"] for b in bills] == ["Mortgage"]
    assert income[0]["amount"] == 3000.0
    assert bills[0]["amount"] == 1100.0
    # Carried items remain recurring and preserve category/due_date.
    assert income[0]["is_recurring"] is True
    assert bills[0]["is_recurring"] is True
    assert bills[0]["category"] == "Housing"
    assert bills[0]["due_date"] == 1


def test_preview_includes_category(client, db_session):
    _seed_previous(db_session)
    body = client.get("/api/months/carry-forward-preview", params={"month": "2026-06"}).json()
    assert body["bills"][0]["category"] == "Housing"


def test_carry_forward_income_amount_override(client, db_session):
    prev = _seed_previous(db_session)
    salary = next(i for i in prev.income_entries if i.label == "Salary")
    resp = client.post(
        "/api/months",
        json={
            "month": "2026-06",
            "carry_forward": True,
            "overrides": [{"source_type": "income", "source_id": salary.id, "amount": 3300.0}],
        },
    )
    new_id = resp.json()["id"]
    income = client.get(f"/api/months/{new_id}/income").json()
    assert income[0]["amount"] == 3300.0


def test_previous_month_is_most_recent(client, db_session):
    """With several prior months, carry-forward sources the latest one."""
    make_income(
        db_session,
        make_month(db_session, month="2026-03").id,
        label="Old",
        amount=1.0,
        is_recurring=True,
    )
    make_income(
        db_session,
        make_month(db_session, month="2026-04").id,
        label="Recent",
        amount=2.0,
        is_recurring=True,
    )
    body = client.get("/api/months/carry-forward-preview", params={"month": "2026-05"}).json()
    assert body["from_month"] == "2026-04"
    assert [i["label"] for i in body["income"]] == ["Recent"]


def test_carry_forward_with_amount_override(client, db_session):
    prev = _seed_previous(db_session)
    bill = next(b for b in prev.bills if b.label == "Mortgage")
    resp = client.post(
        "/api/months",
        json={
            "month": "2026-06",
            "carry_forward": True,
            "overrides": [{"source_type": "bill", "source_id": bill.id, "amount": 1200.0}],
        },
    )
    new_id = resp.json()["id"]
    bills = client.get(f"/api/months/{new_id}/bills").json()
    assert bills[0]["amount"] == 1200.0
    # Previous month unchanged.
    prev_bills = client.get(f"/api/months/{prev.id}/bills").json()
    assert next(b["amount"] for b in prev_bills if b["label"] == "Mortgage") == 1100.0


def test_carry_forward_with_exclusion(client, db_session):
    prev = _seed_previous(db_session)
    income = next(i for i in prev.income_entries if i.label == "Salary")
    resp = client.post(
        "/api/months",
        json={
            "month": "2026-06",
            "carry_forward": True,
            "overrides": [{"source_type": "income", "source_id": income.id, "exclude": True}],
        },
    )
    new_id = resp.json()["id"]
    assert client.get(f"/api/months/{new_id}/income").json() == []


def test_carry_forward_skips_non_recurring_but_keeps_later_recurring(client, db_session):
    """A non-recurring item must be skipped (continue), not stop the loop."""
    prev = make_month(db_session, month="2026-05")
    # Non-recurring FIRST, recurring SECOND — so `break` would drop the recurring one.
    make_income(db_session, prev.id, label="Bonus", amount=500.0, is_recurring=False)
    make_income(db_session, prev.id, label="Salary", amount=3000.0, is_recurring=True)
    make_bill(db_session, prev.id, label="Boiler", amount=120.0, is_recurring=False)
    make_bill(db_session, prev.id, label="Mortgage", amount=1100.0, is_recurring=True)

    new_id = client.post("/api/months", json={"month": "2026-06", "carry_forward": True}).json()[
        "id"
    ]
    assert [i["label"] for i in client.get(f"/api/months/{new_id}/income").json()] == ["Salary"]
    assert [b["label"] for b in client.get(f"/api/months/{new_id}/bills").json()] == ["Mortgage"]


def test_carry_forward_excludes_first_keeps_second(client, db_session):
    """Excluding one recurring item must skip it but still carry the next."""
    prev = make_month(db_session, month="2026-05")
    inc_a = make_income(db_session, prev.id, label="Salary A", amount=1000.0, is_recurring=True)
    make_income(db_session, prev.id, label="Salary B", amount=2000.0, is_recurring=True)
    bill_a = make_bill(db_session, prev.id, label="Bill A", amount=10.0, is_recurring=True)
    make_bill(db_session, prev.id, label="Bill B", amount=20.0, is_recurring=True)

    new_id = client.post(
        "/api/months",
        json={
            "month": "2026-06",
            "carry_forward": True,
            "overrides": [
                {"source_type": "income", "source_id": inc_a.id, "exclude": True},
                {"source_type": "bill", "source_id": bill_a.id, "exclude": True},
            ],
        },
    ).json()["id"]
    assert [i["label"] for i in client.get(f"/api/months/{new_id}/income").json()] == ["Salary B"]
    assert [b["label"] for b in client.get(f"/api/months/{new_id}/bills").json()] == ["Bill B"]


def test_skip_carry_forward_blank_month(client, db_session):
    _seed_previous(db_session)
    resp = client.post("/api/months", json={"month": "2026-06", "carry_forward": False})
    new_id = resp.json()["id"]
    assert client.get(f"/api/months/{new_id}/income").json() == []
    assert client.get(f"/api/months/{new_id}/bills").json() == []


def test_accounts_not_carried_forward(client, db_session):
    _seed_previous(db_session)
    make_account(db_session, label="Joint", balance=2300.0)
    client.post("/api/months", json={"month": "2026-06", "carry_forward": True})
    accounts = client.get("/api/accounts").json()
    assert len(accounts["accounts"]) == 1
