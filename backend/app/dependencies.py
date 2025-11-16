from functools import lru_cache
from typing import Optional

from fastapi import Depends, HTTPException, Header, status
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


def get_current_user(
    authorization: Optional[str] = Header(None),
    client: Client = Depends(supabase_client),
) -> dict:
    """Extract and verify the current user from the Authorization header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract token from "Bearer <token>" format
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise ValueError("Invalid authorization scheme")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify token and get user
    try:
        user_response = client.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_response.user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to verify authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
