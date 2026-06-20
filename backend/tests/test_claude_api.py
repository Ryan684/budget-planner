"""Endpoint tests for /api/claude and /api/claude/undo (Anthropic mocked)."""

from datetime import date, timedelta

import anthropic
import models

from tests.factories import make_account, make_bill, make_income, make_month
from tests.fake_anthropic import FakeAnthropic, install, text_turn, tool_turn


def _seed(db_session):
    """A current month with income, bills, and accounts."""
    make_month(db_session, month="2026-05")
    month = make_month(db_session, month="2026-06")
    make_income(db_session, month.id, label="Salary", amount=3200.0)
    make_bill(db_session, month.id, label="Mortgage", amount=1100.0, category="Housing")
    make_bill(db_session, month.id, label="Electricity", amount=85.0, category="Utilities")
    make_account(db_session, label="Savings", balance=8400.0, account_type="savings")
    return month


# ---------------------------------------------------------------------------
# User Story 1 — querying
# ---------------------------------------------------------------------------
def test_query_returns_reply_and_summary(client, db_session, monkeypatch):
    _seed(db_session)
    install(monkeypatch, FakeAnthropic([text_turn("Your surplus this month is £2,015.00.")]))
    resp = client.post("/api/claude", json={"message": "what's our surplus this month?"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["reply"].startswith("Your surplus")
    assert body["writes"] == []
    assert body["summary"]["monthly_surplus"] == 2015.0  # 3200 - (1100+85)


def test_query_sends_balance_and_as_of_to_claude(client, db_session, monkeypatch):
    _seed(db_session)
    fake = install(monkeypatch, FakeAnthropic([text_turn("Savings is £8,400.00 as of ...")]))
    client.post("/api/claude", json={"message": "how much in savings?"})
    system = fake.create_calls[0]["system"]
    assert "8400.0" in system  # the balance is in the context Claude reads


def test_scenario_question_writes_nothing(client, db_session, monkeypatch):
    _seed(db_session)
    install(
        monkeypatch,
        FakeAnthropic([text_turn("If the mortgage rose £150, surplus would be £1,865.")]),
    )
    resp = client.post(
        "/api/claude", json={"message": "if the mortgage goes up £150 what happens?"}
    )
    assert resp.json()["writes"] == []
    assert db_session.query(models.Amendment).count() == 0


def test_conversation_history_is_sent(client, db_session, monkeypatch):
    _seed(db_session)
    fake = install(monkeypatch, FakeAnthropic([text_turn("Yes.")]))
    client.post(
        "/api/claude",
        json={
            "message": "and last month?",
            "conversation": [
                {"role": "user", "content": "what's our surplus?"},
                {"role": "assistant", "content": "£2,015.00."},
            ],
        },
    )
    sent = fake.create_calls[0]["messages"]
    assert [m["content"] for m in sent] == ["what's our surplus?", "£2,015.00.", "and last month?"]


def test_stale_balance_flagged_in_context_for_read(client, db_session, monkeypatch):
    make_month(db_session, month="2026-06")
    make_account(
        db_session, label="Old savings", balance=8400.0, as_of=date.today() - timedelta(days=45)
    )
    fake = install(monkeypatch, FakeAnthropic([text_turn("That balance may be out of date.")]))
    client.post("/api/claude", json={"message": "how much in savings?"})
    system = fake.create_calls[0]["system"]
    assert '"is_stale": true' in system


def test_context_overflow_trims_oldest_conversation(client, db_session, monkeypatch):
    _seed(db_session)
    # token count grows with message count → forces trimming down to the last message
    fake = FakeAnthropic([text_turn("ok")], token_fn=lambda kw: len(kw["messages"]) * 100_000)
    install(monkeypatch, fake)
    long_convo = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"m{i}"} for i in range(6)
    ]
    client.post("/api/claude", json={"message": "latest question", "conversation": long_convo})
    sent = fake.create_calls[0]["messages"]
    assert len(sent) == 1
    assert sent[0]["content"] == "latest question"  # current message is never trimmed
    assert fake.create_calls[0]["system"]  # financial context untouched


def test_assistant_unavailable_returns_502_no_write(client, db_session, monkeypatch):
    _seed(db_session)
    install(monkeypatch, FakeAnthropic(raise_on_create=anthropic.AnthropicError("backend down")))
    resp = client.post("/api/claude", json={"message": "what's our surplus?"})
    assert resp.status_code == 502
    assert db_session.query(models.Amendment).count() == 0


def test_empty_message_rejected(client, db_session, monkeypatch):
    _seed(db_session)
    install(monkeypatch, FakeAnthropic([text_turn("hi")]))
    assert client.post("/api/claude", json={"message": ""}).status_code == 422


# ---------------------------------------------------------------------------
# User Story 2 — writing
# ---------------------------------------------------------------------------
def test_add_bill_writes_and_logs(client, db_session, monkeypatch):
    month = _seed(db_session)
    install(
        monkeypatch,
        FakeAnthropic(
            [
                tool_turn(
                    [
                        (
                            "add_bill",
                            {
                                "label": "Water",
                                "amount": 45.0,
                                "category": "Utilities",
                                "reason": "User asked to add a £45 water bill",
                            },
                        )
                    ]
                ),
                text_turn("I'll add a £45.00 water bill; surplus falls to £1,970.00. Done."),
            ]
        ),
    )
    resp = client.post("/api/claude", json={"message": "add a £45 water bill"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["writes"]) == 1
    assert body["writes"][0]["entity_type"] == "bill"
    assert body["writes"][0]["reason"] == "User asked to add a £45 water bill"
    assert body["summary"]["total_bills"] == 1230.0  # 1100 + 85 + 45
    bill = db_session.query(models.Bill).filter(models.Bill.label == "Water").one()
    assert bill.month_id == month.id
    amendment = db_session.get(models.Amendment, body["writes"][0]["amendment_id"])
    assert amendment.source == "claude"


def test_update_account_balance_writes_snapshot(client, db_session, monkeypatch):
    _seed(db_session)
    account = db_session.query(models.AccountBalance).filter_by(label="Savings").one()
    install(
        monkeypatch,
        FakeAnthropic(
            [
                tool_turn(
                    [
                        (
                            "update_account_balance",
                            {
                                "account_id": account.id,
                                "balance": 8900.0,
                                "reason": "User updated savings",
                            },
                        )
                    ]
                ),
                text_turn("Updated savings to £8,900.00."),
            ]
        ),
    )
    resp = client.post("/api/claude", json={"message": "update savings to £8,900"})
    assert resp.status_code == 200
    db_session.refresh(account)
    assert account.balance == 8900.0
    snaps = db_session.query(models.AccountBalanceSnapshot).filter_by(account_id=account.id).all()
    assert snaps[-1].balance == 8900.0


def test_edit_bill_amount(client, db_session, monkeypatch):
    _seed(db_session)
    elec = db_session.query(models.Bill).filter_by(label="Electricity").one()
    install(
        monkeypatch,
        FakeAnthropic(
            [
                tool_turn(
                    [
                        (
                            "update_bill",
                            {"bill_id": elec.id, "amount": 97.0, "reason": "Bill increased"},
                        )
                    ]
                ),
                text_turn("Electricity updated to £97.00."),
            ]
        ),
    )
    client.post("/api/claude", json={"message": "change electricity to £97"})
    db_session.refresh(elec)
    assert elec.amount == 97.0


def test_delete_bill(client, db_session, monkeypatch):
    month = _seed(db_session)
    boiler = make_bill(db_session, month.id, label="Boiler service", amount=120.0, category="Home")
    install(
        monkeypatch,
        FakeAnthropic(
            [
                tool_turn([("delete_bill", {"bill_id": boiler.id, "reason": "No longer needed"})]),
                text_turn("Removed the boiler service bill."),
            ]
        ),
    )
    client.post("/api/claude", json={"message": "remove the boiler service bill"})
    assert db_session.get(models.Bill, boiler.id) is None


def test_previous_month_write_refused_no_change(client, db_session, monkeypatch):
    previous = make_month(db_session, month="2026-05")
    make_month(db_session, month="2026-06")  # current
    old_bill = make_bill(db_session, previous.id, label="Old insurance", amount=30.0)
    install(
        monkeypatch,
        FakeAnthropic(
            [
                tool_turn(
                    [("update_bill", {"bill_id": old_bill.id, "amount": 50.0, "reason": "x"})]
                ),
                text_turn("I can't change a previous month."),
            ]
        ),
    )
    resp = client.post("/api/claude", json={"message": "update the old insurance to £50"})
    assert resp.status_code == 200
    assert resp.json()["writes"] == []
    db_session.refresh(old_bill)
    assert old_bill.amount == 30.0  # unchanged


def test_atomic_rollback_when_one_write_in_turn_fails(client, db_session, monkeypatch):
    month = _seed(db_session)
    install(
        monkeypatch,
        FakeAnthropic(
            [
                # first add succeeds, second targets a missing bill → whole turn rolls back
                tool_turn(
                    [
                        (
                            "add_bill",
                            {
                                "label": "Water",
                                "amount": 45.0,
                                "category": "Utilities",
                                "reason": "add water",
                            },
                            "t1",
                        ),
                        ("update_bill", {"bill_id": 9999, "amount": 1.0, "reason": "bad"}, "t2"),
                    ]
                ),
                text_turn("Something went wrong; nothing was changed."),
            ]
        ),
    )
    resp = client.post("/api/claude", json={"message": "add water and edit a bill"})
    assert resp.status_code == 200
    assert resp.json()["writes"] == []
    assert db_session.query(models.Bill).filter_by(label="Water").count() == 0
    assert db_session.query(models.Amendment).count() == 0
    _ = month


def test_stale_balance_flagged_in_context_for_write(client, db_session, monkeypatch):
    make_month(db_session, month="2026-06")
    account = make_account(
        db_session, label="Savings", balance=8400.0, as_of=date.today() - timedelta(days=45)
    )
    fake = install(
        monkeypatch,
        FakeAnthropic(
            [
                tool_turn(
                    [
                        (
                            "update_account_balance",
                            {"account_id": account.id, "balance": 8900.0, "reason": "update"},
                        )
                    ]
                ),
                text_turn("Note: that balance was last updated 45 days ago. Updated to £8,900.00."),
            ]
        ),
    )
    client.post("/api/claude", json={"message": "set savings to 8900"})
    system = fake.create_calls[0]["system"]
    assert '"is_stale": true' in system  # Claude is told the balance is stale before writing


# ---------------------------------------------------------------------------
# User Story 3 — undo
# ---------------------------------------------------------------------------
def _claude_add_bill(client, monkeypatch, label, amount):
    install(
        monkeypatch,
        FakeAnthropic(
            [
                tool_turn(
                    [
                        (
                            "add_bill",
                            {
                                "label": label,
                                "amount": amount,
                                "category": "Utilities",
                                "reason": f"add {label}",
                            },
                        )
                    ]
                ),
                text_turn(f"Added {label}."),
            ]
        ),
    )
    return client.post("/api/claude", json={"message": f"add {label}"}).json()


def test_undo_reverts_last_claude_write(client, db_session, monkeypatch):
    _seed(db_session)
    body = _claude_add_bill(client, monkeypatch, "Water", 120.0)
    amendment_id = body["writes"][0]["amendment_id"]
    assert db_session.query(models.Bill).filter_by(label="Water").count() == 1

    undo = client.post("/api/claude/undo", json={"amendment_ids": [amendment_id]})
    assert undo.status_code == 200
    assert undo.json()["reverted"] == [amendment_id]
    assert db_session.query(models.Bill).filter_by(label="Water").count() == 0
    assert undo.json()["summary"]["total_bills"] == 1185.0  # back to 1100 + 85


def test_undo_only_touches_claude_writes(client, db_session, monkeypatch):
    _seed(db_session)
    # a manual user edit
    elec = db_session.query(models.Bill).filter_by(label="Electricity").one()
    client.patch(f"/api/bills/{elec.id}", json={"amount": 90.0})
    # a Claude write
    body = _claude_add_bill(client, monkeypatch, "Water", 45.0)
    claude_amendment = body["writes"][0]["amendment_id"]

    client.post("/api/claude/undo", json={"amendment_ids": [claude_amendment]})
    db_session.refresh(elec)
    assert elec.amount == 90.0  # manual edit untouched
    assert db_session.query(models.Bill).filter_by(label="Water").count() == 0


def test_undo_user_amendment_rejected(client, db_session, monkeypatch):
    _seed(db_session)
    elec = db_session.query(models.Bill).filter_by(label="Electricity").one()
    client.patch(f"/api/bills/{elec.id}", json={"amount": 90.0})
    user_amendment = db_session.query(models.Amendment).filter_by(source="user").first()
    resp = client.post("/api/claude/undo", json={"amendment_ids": [user_amendment.id]})
    assert resp.status_code == 422


def test_undo_reverts_only_most_recent_of_three(client, db_session, monkeypatch):
    _seed(db_session)
    a = _claude_add_bill(client, monkeypatch, "Water", 10.0)["writes"][0]["amendment_id"]
    b = _claude_add_bill(client, monkeypatch, "Gas", 20.0)["writes"][0]["amendment_id"]
    c = _claude_add_bill(client, monkeypatch, "Broadband", 30.0)["writes"][0]["amendment_id"]

    client.post("/api/claude/undo", json={"amendment_ids": [c]})
    labels = {b.label for b in db_session.query(models.Bill).all()}
    assert "Broadband" not in labels  # latest reverted
    assert {"Water", "Gas"} <= labels  # earlier two remain
    _ = (a, b)


def test_undo_is_logged_as_new_append_only_amendment(client, db_session, monkeypatch):
    _seed(db_session)
    amendment_id = _claude_add_bill(client, monkeypatch, "Water", 45.0)["writes"][0]["amendment_id"]
    client.post("/api/claude/undo", json={"amendment_ids": [amendment_id]})
    # the original amendment still exists (append-only)
    assert db_session.get(models.Amendment, amendment_id) is not None
    # a new reversing amendment was logged
    reversal = (
        db_session.query(models.Amendment)
        .filter(models.Amendment.reason == f"Undo of Claude change #{amendment_id}")
        .one()
    )
    assert reversal.source == "claude"


# ---------------------------------------------------------------------------
# User Story 4 — cross-month
# ---------------------------------------------------------------------------
def test_comparison_has_both_months_in_context(client, db_session, monkeypatch):
    _seed(db_session)  # two months exist
    fake = install(monkeypatch, FakeAnthropic([text_turn("June surplus is higher than May.")]))
    resp = client.post(
        "/api/claude", json={"message": "how does this month compare to last month?"}
    )
    assert resp.status_code == 200
    system = fake.create_calls[0]["system"]
    assert '"2026-05"' in system and '"2026-06"' in system


def test_single_month_comparison_is_graceful(client, db_session, monkeypatch):
    make_month(db_session, month="2026-06")  # only one month
    fake = install(
        monkeypatch, FakeAnthropic([text_turn("There's no previous month to compare against yet.")])
    )
    resp = client.post("/api/claude", json={"message": "how does this compare to last month?"})
    assert resp.status_code == 200
    months_in_context = fake.create_calls[0]["system"].count('"month":')
    assert months_in_context == 1
