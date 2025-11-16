from functools import lru_cache

from fastapi import Depends, HTTPException, status
from supabase import Client, create_client

from .config import get_settings, Settings


@lru_cache
def _cached_client(supabase_url: str, supabase_key: str) -> Client:
    try:
        return create_client(supabase_url, supabase_key)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to initialize Supabase client",
        ) from exc


def supabase_client(settings: Settings = Depends(get_settings)) -> Client:
    return _cached_client(settings.supabase_url, settings.supabase_anon_key)
