"""Settings load .env.local from the repo root regardless of the process's CWD.

`uvicorn` always runs with the backend/ directory as its working directory — both
locally (README, "Local development": `cd backend && uvicorn ...`) and on the Pi
(the systemd unit's `WorkingDirectory=`). pydantic-settings resolves a relative
`env_file` against the process CWD with no upward search (unlike python-dotenv's
`load_dotenv()`, which family-dashboard relies on and which does walk up). A
`.env.local` placed "in the repo root" per the README was therefore silently never
read: every setting fell back to its class default with no error.

`config._REPO_ROOT` is computed once, from config.py's own file location, so it
cannot be faked by pointing a test at a temporary directory tree — these tests
exercise it against the real repo root, temporarily writing and then removing a
real `.env.local` there.
"""

from pathlib import Path

import config as config_module
import pytest
from config import Settings


def test_repo_root_is_one_level_above_backend():
    """The property the fix depends on: _REPO_ROOT is the directory containing
    backend/, not backend/ itself and not wherever the process happens to be
    running from."""
    repo_root = config_module._REPO_ROOT

    assert repo_root.name != "backend"
    expected = Path(__file__).resolve().parent.parent / "config.py"
    assert (repo_root / "backend" / "config.py").resolve() == expected


@pytest.fixture
def real_env_local(monkeypatch, tmp_path):
    """Write a real .env.local at the actual repo root, run the test with CWD
    changed to somewhere else entirely (proving CWD is irrelevant), then remove
    it unconditionally so nothing leaks into the working tree."""
    target = config_module._REPO_ROOT / ".env.local"
    assert not target.exists(), "a real .env.local already exists — refusing to overwrite it"

    def _write(content: str) -> None:
        target.write_text(content)
        # A CWD far from both the repo root and backend/, so a pass here can't be
        # explained by an accidental relative-path match.
        monkeypatch.chdir(tmp_path)

    try:
        yield _write
    finally:
        target.unlink(missing_ok=True)


def test_env_local_at_repo_root_is_loaded_regardless_of_cwd(real_env_local):
    real_env_local("ANTHROPIC_API_KEY=sk-ant-from-repo-root\nAPP_PIN=4321\n")

    settings = Settings()

    assert settings.anthropic_api_key == "sk-ant-from-repo-root"
    assert settings.app_pin == "4321"


def test_missing_env_local_falls_back_to_defaults(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    settings = Settings()

    assert settings.anthropic_api_key == ""
    assert settings.app_pin == ""
    assert settings.database_url == "./data/budget-dev.db"
