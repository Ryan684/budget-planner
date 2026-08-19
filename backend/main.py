"""FastAPI application entry point for the Family Budget Planner backend."""

from contextlib import asynccontextmanager
from pathlib import Path

from database import init_db
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from routers import accounts, amendments, auth, bills, claude, income, months, system

# The production build emitted by `npm run build`. Served by this app so the whole
# thing is one process on one port — see mount_frontend below.
DIST_DIR = Path(__file__).parent.parent / "frontend" / "dist"


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
app.include_router(system.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    """Liveness check."""
    return {"status": "ok"}


def mount_frontend(target: FastAPI, dist_dir: Path) -> bool:
    """Serve the built frontend from ``dist_dir``, if it has been built.

    One process on one port: the Pi is shared with the family dashboard, so the
    budget planner does not run a second static-file service. Serving the bundle
    from the same origin as the API is also what makes the relative ``/api`` base
    in ``frontend/src/api/client.ts`` resolve — no absolute API base URL to
    configure at build time, and no CORS configuration.

    Mounted at "/" rather than only "/assets" because Vite copies ``public/``
    (favicon.svg, icons.svg) into the dist root, and ``index.html`` references
    ``/favicon.svg``. The mount is greedy for any path not already matched, so it
    MUST be registered after every router — hence the call at the end of this
    module rather than beside the other route declarations.

    Returns whether a frontend was mounted. In development the frontend runs under
    Vite on its own port and ``dist/`` does not exist; mounting a missing directory
    raises at startup, so an unbuilt frontend is a no-op and the API serves alone.
    """
    if not (dist_dir / "index.html").is_file():
        return False
    target.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
    return True


mount_frontend(app, DIST_DIR)
