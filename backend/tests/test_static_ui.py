"""The backend serves the built frontend, so the app lives on a single origin.

Feature: Shared-Pi Deployment (docs/budget-planner.feature).

Two deployments share one Raspberry Pi 5, so the budget planner runs one process
on one port instead of a backend plus a static file server. That also removes the
bug this replaced: the built bundle asks for a relative ``/api`` (see
``frontend/src/api/client.ts``), which the previous ``python3 -m http.server``
on port 5173 could not answer.

``mount_frontend`` takes the dist directory as an argument rather than reading a
module-level constant so these tests can point it at a temporary build. The real
app calls it once at import with ``DIST_DIR``.
"""

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from main import DIST_DIR, mount_frontend


@pytest.fixture
def built_dist(tmp_path: Path) -> Path:
    """A minimal stand-in for `npm run build` output.

    Mirrors the real layout: index.html and hashed bundles under assets/, plus the
    files Vite copies from public/ into the dist root (favicon.svg, icons.svg).
    """
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>Budget</title>")
    (dist / "assets" / "index-abc123.js").write_text("console.log('app')")
    (dist / "favicon.svg").write_text("<svg/>")
    return dist


def make_app(dist: Path) -> FastAPI:
    """A bare app with one API route, to prove the mount does not shadow /api."""
    app = FastAPI()

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    mount_frontend(app, dist)
    return app


# ---------------------------------------------------------------------------
# Serving a built frontend
# ---------------------------------------------------------------------------
def test_serves_index_html_at_the_root(built_dist):
    with TestClient(make_app(built_dist)) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert "<!doctype html>" in response.text


def test_serves_hashed_assets(built_dist):
    with TestClient(make_app(built_dist)) as client:
        response = client.get("/assets/index-abc123.js")

    assert response.status_code == 200
    assert response.text == "console.log('app')"


def test_serves_files_copied_from_public(built_dist):
    """Vite copies public/ into the dist root, not into assets/ — index.html
    references /favicon.svg, so a mount covering only /assets would 404 it."""
    with TestClient(make_app(built_dist)) as client:
        response = client.get("/favicon.svg")

    assert response.status_code == 200
    assert response.text == "<svg/>"


def test_api_routes_are_not_shadowed_by_the_frontend(built_dist):
    """The mount is greedy for unmatched paths, so it must be registered last."""
    with TestClient(make_app(built_dist)) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_reports_that_it_mounted(built_dist):
    assert mount_frontend(FastAPI(), built_dist) is True


# ---------------------------------------------------------------------------
# No build present (development)
# ---------------------------------------------------------------------------
def test_does_not_mount_when_dist_is_missing(tmp_path):
    """In development the frontend runs under Vite on its own port and dist/ does
    not exist. Mounting a missing directory raises at startup, so this must be a
    no-op rather than a crash."""
    assert mount_frontend(FastAPI(), tmp_path / "nope") is False


def test_does_not_mount_a_dist_without_index_html(tmp_path):
    """A half-written or cleaned build directory is not a usable frontend."""
    empty = tmp_path / "dist"
    empty.mkdir()

    assert mount_frontend(FastAPI(), empty) is False


def test_api_still_serves_when_no_frontend_is_mounted(tmp_path):
    app = make_app(tmp_path / "nope")

    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404


def test_real_app_points_at_the_frontend_build_directory():
    """DIST_DIR must resolve to frontend/dist next to the backend, so a Pi deploy
    that runs `npm run build` is picked up with no extra configuration."""
    assert DIST_DIR.name == "dist"
    assert DIST_DIR.parent.name == "frontend"
    assert (DIST_DIR.parent.parent / "backend" / "main.py").is_file()
