from pydantic import AnyHttpUrl, BaseSettings


class Settings(BaseSettings):
    supabase_url: AnyHttpUrl
    supabase_anon_key: str
    supabase_service_role_key: str | None = None
    allowed_origins: list[str] = ["*"]
    ai_expiry_endpoint: AnyHttpUrl | None = None
    ai_expiry_api_key: str | None = None

    class Config:
        env_file = ".env"
        case_sensitive = False


def get_settings() -> Settings:
    return Settings()
