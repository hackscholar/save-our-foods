from pydantic import AnyHttpUrl, BaseSettings


class Settings(BaseSettings):
    # TODO: Add your Supabase project URL from https://app.supabase.com/project/_/settings/api
    supabase_url: AnyHttpUrl
    # TODO: Add your Supabase anonymous/public key from https://app.supabase.com/project/_/settings/api
    supabase_anon_key: str
    # TODO: Add your Supabase service role key (optional, for admin operations)
    # WARNING: Keep this secret! Never expose this in client-side code.
    supabase_service_role_key: str | None = None
    # TODO: Configure allowed origins for CORS (comma-separated)
    # For localhost: http://localhost:3000,http://localhost:8080,http://127.0.0.1:5500
    allowed_origins: list[str] = ["*"]
    # TODO: Add AI expiry estimation endpoint (optional)
    # This is for the AI estimator service that predicts food expiry dates
    ai_expiry_endpoint: AnyHttpUrl | None = None
    # TODO: Add AI expiry API key (optional)
    # API key for authenticating with the AI estimator service
    ai_expiry_api_key: str | None = None

    class Config:
        env_file = ".env"
        case_sensitive = False


def get_settings() -> Settings:
    return Settings()
