"""Pytest fixtures: in-memory SQLite engine, session, and TestClient."""

from dataclasses import dataclass
from datetime import date
from pathlib import Path

import models
import pytest
from database import Base, get_db
from fastapi.testclient import TestClient
from main import app
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from tests.factories import make_account, make_bill, make_income, make_month


@pytest.fixture
def engine():
    """A fresh in-memory SQLite database per test (shared across connections)."""
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    import models  # noqa: F401  (register models on metadata)

    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture
def db_session(engine):
    """A SQLAlchemy session bound to the per-test engine."""
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    """A FastAPI TestClient using the per-test database session."""

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@dataclass
class SeededDB:
    """A seeded, file-backed SQLite database for the backup tests.

    The backup module copies the *file* at ``db_path`` via the SQLite online-backup
    API, while ``session`` reads the same data through the ORM for the JSON export —
    so the fixture exposes both.
    """

    session: Session
    db_path: Path


@pytest.fixture
def seeded_db(tmp_path):
    """A file-backed SQLite DB with one month (income + bill) and one account
    (with a balance snapshot), used by all backup tests in test_backup.py."""
    db_path = tmp_path / "budget.db"
    eng = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=eng)
    TestingSessionLocal = sessionmaker(bind=eng, autoflush=False, autocommit=False)
    session = TestingSessionLocal()

    month = make_month(session, month="2026-06")
    make_income(session, month.id, label="Ryan salary", amount=3200.0)
    make_bill(session, month.id, label="Mortgage", amount=1100.0)
    account = make_account(session, label="Joint current", balance=4200.0)
    session.add(
        models.AccountBalanceSnapshot(
            account_id=account.id, balance=4200.0, as_of_date=date.today()
        )
    )
    session.commit()

    try:
        yield SeededDB(session=session, db_path=db_path)
    finally:
        session.close()
        eng.dispose()
