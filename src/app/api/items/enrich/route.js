import { NextResponse } from "next/server";
import { generateItemMetadataFromImage } from "@/lib/ai";
import { getItemById, updateItem } from "@/lib/items";

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const itemId = payload?.itemId ?? payload?.item_id ?? null;
  const overrideImageUrl = payload?.imageUrl ?? payload?.image_url ?? null;
  const providedPurchaseDate = payload?.dateOfPurchase ?? payload?.date_of_purchase ?? null;

  if (!itemId && !overrideImageUrl) {
    return NextResponse.json(
      { error: "Provide either itemId (to read imagePath from DB) or imageUrl." },
      { status: 400 },
    );
  }

  let itemRecord = null;
  if (itemId) {
    itemRecord = await getItemById(itemId);
    if (!itemRecord) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
  }

  const imageUrl = overrideImageUrl ?? itemRecord?.imagePath;
  if (!imageUrl) {
    return NextResponse.json(
      { error: "No image URL available. Upload an image or pass imageUrl explicitly." },
      { status: 400 },
    );
  }

  try {
    const aiResult = await generateItemMetadataFromImage(imageUrl, {
      dateOfPurchase: itemRecord?.dateOfPurchase ?? providedPurchaseDate ?? null,
    });

    let updatedItem = itemRecord;
    if (itemId) {
      const patch = {};
      if (aiResult.name) patch.name = aiResult.name;
      if (aiResult.expiryDate) patch.expiryDate = aiResult.expiryDate;
      if (Object.keys(patch).length > 0) {
        updatedItem = await updateItem(itemId, patch);
      }
    }

    return NextResponse.json({
      ai: aiResult,
      item: updatedItem ?? null,
    });
  } catch (error) {
    console.error("Failed to generate AI metadata", error);
    return NextResponse.json(
      { error: "Unable to generate item metadata right now. Please try again later." },
      { status: 500 },
    );
  }
}
