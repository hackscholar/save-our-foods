from datetime import date, timedelta
from typing import Optional

import httpx


class ExpiryEstimator:
    def __init__(self, endpoint: str | None = None, api_key: str | None = None) -> None:
        self.endpoint = endpoint
        self.api_key = api_key

    async def estimate(self, image_url: str) -> Optional[date]:
        if not self.endpoint:
            return None

        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        async with httpx.AsyncClient() as client:
            response = await client.post(self.endpoint, json={"image_url": image_url}, headers=headers, timeout=20)
            response.raise_for_status()
            payload = response.json()
            expiry_days = payload.get("estimated_days")

        if isinstance(expiry_days, int) and expiry_days > 0:
            return date.today() + timedelta(days=expiry_days)
        return None
