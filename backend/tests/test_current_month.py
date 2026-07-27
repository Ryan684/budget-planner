"""Resolving "the current month" (Phase 5, US2).

One definition, used everywhere: the ``BudgetMonth`` whose ``month`` equals the
current **local** calendar month. This supersedes the Phase 2/3 "latest month"
rule. The reference date is injectable so these tests never depend on the clock.
"""

from datetime import date

import current_month

from tests.factories import make_month

MAY = date(2026, 5, 17)
JUNE = date(2026, 6, 17)


def test_month_key_is_the_local_calendar_month(db_session):
    assert current_month.month_key(JUNE) == "2026-06"
    assert current_month.month_key(date(2026, 1, 1)) == "2026-01"
    assert current_month.month_key(date(2026, 12, 31)) == "2026-12"


def test_resolves_the_month_matching_the_reference_date(db_session):
    make_month(db_session, month="2026-05")
    june = make_month(db_session, month="2026-06")

    assert current_month.current_month_id(db_session, today=JUNE) == june.id
    assert current_month.current_month(db_session, today=JUNE).month == "2026-06"


def test_is_not_simply_the_latest_month(db_session):
    """A future-dated month must not become the editable month."""
    may = make_month(db_session, month="2026-05")
    make_month(db_session, month="2026-09")

    assert current_month.current_month_id(db_session, today=MAY) == may.id


def test_returns_none_when_the_calendar_month_has_not_been_created(db_session):
    make_month(db_session, month="2026-05")

    assert current_month.current_month_id(db_session, today=JUNE) is None
    assert current_month.current_month(db_session, today=JUNE) is None


def test_returns_none_when_there_are_no_months_at_all(db_session):
    assert current_month.current_month_id(db_session, today=JUNE) is None


def test_defaults_to_today_when_no_reference_date_is_given(db_session):
    today = make_month(db_session, month=date.today().strftime("%Y-%m"))

    assert current_month.current_month_id(db_session) == today.id
