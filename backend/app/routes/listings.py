from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from ..config import get_settings, Settings
from ..dependencies import supabase_client
from ..schemas import Listing, ListingCreate, Purchase, PurchaseRequest
from ..services.vision import ExpiryEstimator

router = APIRouter()


def _estimator(settings: Settings) -> ExpiryEstimator:
    return ExpiryEstimator(endpoint=settings.ai_expiry_endpoint, api_key=settings.ai_expiry_api_key)


async def _estimate_expiry(image_url: str, estimator: ExpiryEstimator) -> Any:
    # In a real implementation, this could trigger a Supabase Function or external AI endpoint.
    return await estimator.estimate(image_url)


@router.get("/", response_model=list[Listing])
def list_listings(client: Client = Depends(supabase_client)) -> list[Listing]:
    result = client.table("listings").select("*").order("created_at", desc=True).execute()
    return [Listing(**row) for row in result.data or []]


@router.post("/", response_model=Listing, status_code=status.HTTP_201_CREATED)
async def create_listing(
    payload: ListingCreate,
    client: Client = Depends(supabase_client),
    settings: Settings = Depends(get_settings),
) -> Listing:
    expires_on = payload.expires_on
    if not expires_on:
        estimator = _estimator(settings)
        expires_on = await _estimate_expiry(payload.image_url, estimator)

    insert_payload = {**payload.dict(), "expires_on": expires_on}
    result = client.table("listings").insert(insert_payload).execute()

    if not result.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to create listing")

    listing = result.data[0]
    return Listing(**listing)


@router.post("/{listing_id}/purchase", response_model=Purchase)
def purchase_listing(listing_id: int, payload: PurchaseRequest, client: Client = Depends(supabase_client)) -> Purchase:
    inventory = client.rpc(
        "decrement_inventory",
        {"listing_id_input": listing_id, "quantity_input": payload.quantity},
    ).execute()

    if inventory.data is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Insufficient stock for purchase")

    purchase_result = client.table("purchases").insert(
        {
            "listing_id": listing_id,
            "buyer_id": payload.buyer_id,
            "quantity": payload.quantity,
            "purchased_at": datetime.utcnow().isoformat(),
        }
    ).execute()

    if not purchase_result.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to record purchase")

    return Purchase(**purchase_result.data[0])
