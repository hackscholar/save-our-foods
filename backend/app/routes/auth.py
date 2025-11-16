from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from ..dependencies import supabase_client
from ..schemas import AuthCredentials, AuthResponse, ProfileCreate

router = APIRouter()


@router.post("/register", response_model=AuthResponse)
def register(
    payload: ProfileCreate, client: Client = Depends(supabase_client)
) -> AuthResponse:
    auth_result = client.auth.sign_up(
        {"email": payload.email, "password": payload.password}
    )
    if auth_result is None or auth_result.session is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to register user"
        )

    # Store all user profile information in Supabase
    client.table("profiles").insert(
        {
            "id": auth_result.user.id,
            "email": payload.email,
            "username": payload.username,
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "profile_picture": str(payload.profile_picture),
            "phone_number": payload.phone_number,
            "address": payload.address,
        }
    ).execute()

    session = auth_result.session
    return AuthResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        token_type=session.token_type,
        expires_in=session.expires_in,
    )


@router.post("/login", response_model=AuthResponse)
def login(
    credentials: AuthCredentials, client: Client = Depends(supabase_client)
) -> AuthResponse:
    auth_result = client.auth.sign_in_with_password(
        {"email": credentials.email, "password": credentials.password}
    )

    if auth_result is None or auth_result.session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    session = auth_result.session
    return AuthResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        token_type=session.token_type,
        expires_in=session.expires_in,
    )
