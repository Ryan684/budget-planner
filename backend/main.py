"""FastAPI application entry point for the Family Budget Planner backend."""

from contextlib import asynccontextmanager

from database import init_db
from fastapi import FastAPI
from routers import accounts, amendments, auth, bills, claude, income, months


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    init_db()
    yield


app = FastAPI(title="Family Budget Planner", lifespan=lifespan)

app.include_router(months.router)
app.include_router(income.router)
app.include_router(bills.router)
app.include_router(accounts.router)
app.include_router(amendments.router)
app.include_router(claude.router)
app.include_router(auth.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    """Liveness check."""
    return {"status": "ok"}
