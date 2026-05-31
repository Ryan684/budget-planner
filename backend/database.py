"""SQLite engine, session factory, declarative base, and DB lifecycle helpers."""

from collections.abc import Generator
from pathlib import Path

from config import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def _build_engine_url(database_url: str) -> str:
    """Turn a filesystem path or sqlite URL into a SQLAlchemy sqlite URL."""
    if database_url.startswith("sqlite"):
        return database_url
    # Ensure the parent directory exists for a file-based SQLite DB.
    db_path = Path(database_url)
    if db_path.parent and not db_path.parent.exists():
        db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{database_url}"


engine = create_engine(
    _build_engine_url(settings.database_url),
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session]:
    """FastAPI dependency yielding a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Imports models so they register with the metadata."""
    import models  # noqa: F401  (registers models on Base.metadata)

    Base.metadata.create_all(bind=engine)
