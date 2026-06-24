"""Application configuration loaded from environment / .env files.

Environment-specific values (database location, optional PIN) are never
hardcoded — they come from the environment via pydantic-settings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the backend."""

    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # SQLite database location. Default is the local dev file (gitignored).
    database_url: str = "./data/budget-dev.db"

    # Optional 4-digit PIN (blank disables it). Unused in Phase 1.
    app_pin: str = ""

    # Anthropic API key for the in-app Claude assistant (Phase 3). Blank in dev
    # means /api/claude returns a friendly "assistant unavailable" error.
    anthropic_api_key: str = ""


settings = Settings()
