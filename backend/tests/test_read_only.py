"""Previous- and future-month read-only guard (Phase 5, US2).

Income and bills may only be created/updated/deleted in the current calendar
month; everything else — notes, accounts, carry-forward — stays open. The API
tests use the real calendar month so they exercise the same helper the app uses.
"""

from datetime import date

import claude_context
import claude_tools
import models
import pytest

from tests.factories import make_bill, make_income, make_month

THIS_MONTH = date.today().strftime("%Y-%m")
PREVIOUS_MONTH = "2000-01"
FUTURE_MONTH = "2999-12"

READ_ONLY = "read-only"


@pytest.fixture
def current(db_session):
    return make_month(db_session, month=THIS_MONTH)


@pytest.fixture
def previous(db_session):
    return make_month(db_session, month=PREVIOUS_MONTH)


# ---------------------------------------------------------------------------
# Income
# ---------------------------------------------------------------------------
def test_create_income_on_a_previous_month_is_rejected(client, db_session, current, previous):
    res = client.post(f"/api/months/{previous.id}/income", json={"label": "Bonus", "amount": 500.0})
    assert res.status_code == 403
    assert READ_ONLY in res.json()["detail"]
    assert db_session.query(models.IncomeEntry).count() == 0


def test_update_income_on_a_previous_month_is_rejected(client, db_session, current, previous):
    entry = make_income(db_session, previous.id, label="Salary", amount=3000.0)

    res = client.patch(f"/api/income/{entry.id}", json={"amount": 1.0})

    assert res.status_code == 403
    db_session.refresh(entry)
    assert entry.amount == 3000.0


def test_delete_income_on_a_previous_month_is_rejected(client, db_session, current, previous):
    entry = make_income(db_session, previous.id)

    res = client.delete(f"/api/income/{entry.id}")

    assert res.status_code == 403
    assert db_session.get(models.IncomeEntry, entry.id) is not None


def test_income_writes_succeed_on_the_current_calendar_month(client, db_session, current):
    created = client.post(
        f"/api/months/{current.id}/income", json={"label": "Salary", "amount": 3000.0}
    )
    assert created.status_code == 201
    income_id = created.json()["id"]

    assert client.patch(f"/api/income/{income_id}", json={"amount": 3100.0}).status_code == 200
    assert client.delete(f"/api/income/{income_id}").status_code == 204


# ---------------------------------------------------------------------------
# Bills
# ---------------------------------------------------------------------------
def test_create_bill_on_a_previous_month_is_rejected(client, db_session, current, previous):
    res = client.post(
        f"/api/months/{previous.id}/bills",
        json={"label": "Water", "amount": 45.0, "category": "Utilities"},
    )
    assert res.status_code == 403
    assert READ_ONLY in res.json()["detail"]
    assert db_session.query(models.Bill).count() == 0


def test_update_bill_on_a_previous_month_is_rejected(client, db_session, current, previous):
    bill = make_bill(db_session, previous.id, label="Mortgage", amount=1100.0)

    res = client.patch(f"/api/bills/{bill.id}", json={"amount": 1.0})

    assert res.status_code == 403
    db_session.refresh(bill)
    assert bill.amount == 1100.0


def test_delete_bill_on_a_previous_month_is_rejected(client, db_session, current, previous):
    bill = make_bill(db_session, previous.id)

    res = client.delete(f"/api/bills/{bill.id}")

    assert res.status_code == 403
    assert db_session.get(models.Bill, bill.id) is not None


def test_bill_writes_succeed_on_the_current_calendar_month(client, db_session, current):
    created = client.post(
        f"/api/months/{current.id}/bills",
        json={"label": "Water", "amount": 45.0, "category": "Utilities"},
    )
    assert created.status_code == 201
    bill_id = created.json()["id"]

    assert client.patch(f"/api/bills/{bill_id}", json={"amount": 47.0}).status_code == 200
    assert client.delete(f"/api/bills/{bill_id}").status_code == 204


# ---------------------------------------------------------------------------
# Future-dated months are read-only too
# ---------------------------------------------------------------------------
def test_a_future_dated_month_is_read_only(client, db_session, current):
    future = make_month(db_session, month=FUTURE_MONTH)

    res = client.post(f"/api/months/{future.id}/income", json={"label": "Bonus", "amount": 500.0})

    assert res.status_code == 403


def test_everything_is_read_only_when_the_calendar_month_does_not_exist(
    client, db_session, previous
):
    """No month matches today, so nothing is editable until it is created."""
    res = client.post(f"/api/months/{previous.id}/income", json={"label": "Bonus", "amount": 500.0})
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# 404 still wins, and unguarded paths stay open
# ---------------------------------------------------------------------------
def test_missing_entities_still_return_404(client, db_session, current):
    assert (
        client.post("/api/months/9999/income", json={"label": "X", "amount": 1.0}).status_code
        == 404
    )
    assert client.patch("/api/income/9999", json={"amount": 1.0}).status_code == 404
    assert client.delete("/api/bills/9999").status_code == 404


def test_notes_remain_editable_on_a_previous_month(client, db_session, current, previous):
    res = client.patch(f"/api/months/{previous.id}", json={"notes": "Reviewed in hindsight"})

    assert res.status_code == 200
    assert res.json()["notes"] == "Reviewed in hindsight"


def test_accounts_remain_editable_while_a_read_only_month_is_active(
    client, db_session, current, previous
):
    """Accounts are not month-scoped (FR-009)."""
    created = client.post(
        "/api/accounts",
        json={"label": "Joint current", "balance": 2300.0, "active_month_id": previous.id},
    )
    assert created.status_code == 201
    account_id = created.json()["id"]

    updated = client.patch(
        f"/api/accounts/{account_id}",
        json={"balance": 2500.0, "active_month_id": previous.id},
    )
    assert updated.status_code == 200
    assert updated.json()["balance"] == 2500.0


def test_carry_forward_into_the_new_month_is_not_blocked(client, db_session, previous):
    """Carry-forward reads the previous month and writes only the new one (FR-010)."""
    make_income(db_session, previous.id, label="Salary", amount=3000.0, is_recurring=True)
    make_bill(db_session, previous.id, label="Mortgage", amount=1100.0, is_recurring=True)

    res = client.post("/api/months", json={"month": THIS_MONTH, "carry_forward": True})

    assert res.status_code == 201
    new_id = res.json()["id"]
    detail = client.get(f"/api/months/{new_id}/detail").json()
    assert [i["label"] for i in detail["income"]] == ["Salary"]
    assert [b["label"] for b in detail["bills"]] == ["Mortgage"]


# ---------------------------------------------------------------------------
# Claude shares the same current month (T015)
# ---------------------------------------------------------------------------
def test_claude_context_targets_the_current_calendar_month(db_session, current):
    make_month(db_session, month=FUTURE_MONTH)  # a later month must not win

    context = claude_context.build_budget_context(db_session)

    assert context["current_month_id"] == current.id


def test_claude_writes_land_in_the_current_calendar_month(db_session, current):
    make_month(db_session, month=FUTURE_MONTH)
    target = claude_context.build_budget_context(db_session)["current_month_id"]

    claude_tools.dispatch(
        db_session,
        target,
        "add_bill",
        {"label": "Water", "amount": 45.0, "category": "Utilities", "reason": "User asked"},
    )
    db_session.flush()

    bill = db_session.query(models.Bill).filter(models.Bill.label == "Water").one()
    assert bill.month_id == current.id


def test_claude_reports_no_write_target_when_the_calendar_month_is_missing(db_session, previous):
    target = claude_context.build_budget_context(db_session)["current_month_id"]
    assert target is None

    with pytest.raises(claude_tools.ToolDispatchError, match="no current month"):
        claude_tools.dispatch(
            db_session,
            target,
            "add_bill",
            {"label": "Water", "amount": 45.0, "category": "Utilities", "reason": "User asked"},
        )
