"""
Configuration de l'application via variables d'environnement.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "postgresql+asyncpg://ustensint:ustensint@db:5432/ustensint"

    # JWT
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_days: int = 7

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost"]

    # File uploads
    upload_dir: str = "/app/uploads"
    max_upload_size_mb: int = 50

    # Allowed email domains (comma-separated)
    allowed_domains: str = "telecom-sudparis.eu"

    model_config = {"env_prefix": "USTENSINT_", "env_file": ".env"}


settings = Settings()
