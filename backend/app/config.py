from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://ustensint:ustensint@db:5432/ustensint",
        validation_alias=AliasChoices("USTENSINT_DATABASE_URL", "DATABASE_URL"),
    )

    # JWT
    jwt_secret_key: str = Field(
        default="change-me-in-production",
        validation_alias=AliasChoices("USTENSINT_JWT_SECRET_KEY", "SECRET_KEY"),
    )
    jwt_algorithm: str = Field(
        default="HS256",
        validation_alias=AliasChoices("USTENSINT_JWT_ALGORITHM", "ALGORITHM"),
    )
    jwt_expiration_days: int = Field(
        default=7,
        validation_alias=AliasChoices("USTENSINT_JWT_EXPIRATION_DAYS", "ACCESS_TOKEN_EXPIRE_DAYS"),
    )

    # CORS
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost"],
        validation_alias=AliasChoices("USTENSINT_CORS_ORIGINS", "CORS_ORIGINS"),
    )

    # File uploads
    upload_dir: str = Field(
        default="/app/uploads",
        validation_alias=AliasChoices("USTENSINT_UPLOAD_DIR", "UPLOAD_DIR"),
    )
    max_upload_size_mb: int = Field(
        default=50,
        validation_alias=AliasChoices("USTENSINT_MAX_UPLOAD_SIZE_MB", "MAX_UPLOAD_SIZE_MB"),
    )

    # Allowed email domains (comma-separated)
    allowed_domains: str = Field(
        default="telecom-sudparis.eu",
        validation_alias=AliasChoices("USTENSINT_ALLOWED_DOMAINS", "ALLOWED_DOMAINS"),
    )

    # SMTP Mail Server
    smtp_host: str = Field(
        default="",
        validation_alias=AliasChoices("USTENSINT_SMTP_HOST", "SMTP_HOST"),
    )
    smtp_port: int = Field(
        default=587,
        validation_alias=AliasChoices("USTENSINT_SMTP_PORT", "SMTP_PORT"),
    )
    smtp_user: str = Field(
        default="",
        validation_alias=AliasChoices("USTENSINT_SMTP_USER", "SMTP_USER"),
    )
    smtp_password: str = Field(
        default="",
        validation_alias=AliasChoices("USTENSINT_SMTP_PASSWORD", "SMTP_PASSWORD"),
    )
    smtp_from: str = Field(
        default="",
        validation_alias=AliasChoices("USTENSINT_SMTP_FROM", "SMTP_FROM"),
    )
    smtp_tls: bool = Field(
        default=True,
        validation_alias=AliasChoices("USTENSINT_SMTP_TLS", "SMTP_TLS"),
    )

    # Public App URL
    public_url: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("USTENSINT_PUBLIC_URL", "PUBLIC_URL"),
    )

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
