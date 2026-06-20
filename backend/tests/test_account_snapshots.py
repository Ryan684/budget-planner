"""A balance snapshot row is written on every account create and update (FR-023)."""

import models

from tests.factories import make_account, make_month


def _snapshots(session, account_id):
    return (
        session.query(models.AccountBalanceSnapshot)
        .filter(models.AccountBalanceSnapshot.account_id == account_id)
        .order_by(models.AccountBalanceSnapshot.id)
        .all()
    )


def test_snapshot_written_on_create(client, db_session):
    resp = client.post(
        "/api/accounts",
        json={"label": "Savings", "balance": 8400.0, "account_type": "savings"},
    )
    account_id = resp.json()["id"]
    snaps = _snapshots(db_session, account_id)
    assert len(snaps) == 1
    assert snaps[0].balance == 8400.0


def test_snapshot_written_on_each_update(client, db_session):
    make_month(db_session, month="2026-06")
    # create via the API so the write goes through crud (the factory inserts raw rows)
    account_id = client.post(
        "/api/accounts",
        json={"label": "Savings", "balance": 8400.0, "account_type": "savings"},
    ).json()["id"]
    client.patch(f"/api/accounts/{account_id}", json={"balance": 8700.0})
    client.patch(f"/api/accounts/{account_id}", json={"balance": 8900.0})

    snaps = _snapshots(db_session, account_id)
    # one for the create + two updates
    assert [s.balance for s in snaps] == [8400.0, 8700.0, 8900.0]


def test_no_snapshot_when_update_changes_nothing(client, db_session):
    account = make_account(db_session, label="Savings", balance=8400.0)
    before = len(_snapshots(db_session, account.id))
    client.patch(f"/api/accounts/{account.id}", json={"balance": 8400.0})  # same value
    after = len(_snapshots(db_session, account.id))
    assert after == before


def test_snapshot_records_as_of_date(client, db_session):
    account = make_account(db_session, label="Joint", balance=100.0)
    client.patch(
        f"/api/accounts/{account.id}",
        json={"balance": 200.0, "as_of_date": "2026-05-30"},
    )
    latest = _snapshots(db_session, account.id)[-1]
    assert latest.balance == 200.0
    assert latest.as_of_date.isoformat() == "2026-05-30"
