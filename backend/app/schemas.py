from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl


class HealthResponse(BaseModel):
    status: str = "ok"


class AuthCredentials(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int | None = None


class ProfileCreate(BaseModel):
    email: str
    password: str
    username: str


class ListingCreate(BaseModel):
    title: str = Field(..., description="Name of the dish or item")
    description: str | None = Field(None, description="Any notes about the item")
    price: float = Field(..., gt=0)
    quantity: int = Field(..., gt=0)
    image_url: HttpUrl
    location: str | None = Field(None, description="Pickup or delivery location details")
    expires_on: Optional[date] = Field(None, description="Estimated expiry date if provided")


class Listing(ListingCreate):
    id: int
    seller_id: str
    created_at: datetime


class PurchaseRequest(BaseModel):
    buyer_id: str
    quantity: int = Field(..., gt=0)


class Purchase(BaseModel):
    id: int
    listing_id: int
    buyer_id: str
    quantity: int
    purchased_at: datetime
