from pydantic import AnyHttpUrl, BaseSettings


class Settings(BaseSettings):
    # TODO: Add your Supabase project URL from https://app.supabase.com/project/_/settings/api
    supabase_url: AnyHttpUrl = "https://vkdjwwrqiorbsdjmojjq.supabase.co"
    # TODO: Add your Supabase anonymous/public key from https://app.supabase.com/project/_/settings/api
    supabase_anon_key: str = (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZramR3d3JxaW9yYnNkam1vampxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE2MzY3NzEsImV4cCI6MjA0NzIxMjc3MX0.b44QX1Q5z94Ou3m27f0uU-hL7s8K98K1-H3G7LQO8"
    )
    # TODO: Add your Supabase service role key (optional, for admin operations)
    # WARNING: Keep this secret! Never expose this in client-side code.
    supabase_service_role_key: str | None = None
    # TODO: Configure allowed origins for CORS (comma-separated)
    # For localhost: http://localhost:3000,http://localhost:8080,http://127.0.0.1:5500
    allowed_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ]
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
