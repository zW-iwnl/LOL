from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Test Manager API"
    app_env: str = Field(default="development", alias="APP_ENV")
    api_prefix: str = "/api"
    database_url: str = Field(
        default="postgresql+psycopg://test_manager:test_manager@postgres:5432/test_manager",
        alias="DATABASE_URL",
    )
    jwt_secret_key: str = Field(default="change-me", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    docs_enabled: bool = Field(default=False, alias="DOCS_ENABLED")
    seed_demo_data: bool = Field(default=False, alias="SEED_DEMO_DATA")
    cors_origins: list[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
        alias="CORS_ORIGINS",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @model_validator(mode="after")
    def validate_production_settings(self):
        weak_secrets = {"change-me", "change-me-in-local-env", ""}
        if self.is_production and self.jwt_secret_key in weak_secrets:
            raise ValueError("JWT_SECRET_KEY must be set to a strong non-default value in production.")
        return self


settings = Settings()
