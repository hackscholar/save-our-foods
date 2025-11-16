import { NextResponse } from "next/server";
import { createItem, validateItemInput, listItemsBySeller, updateItem } from "@/lib/items";

export async function GET(request) {
  const sellerId = request.nextUrl.searchParams.get("sellerId");
  if (!sellerId) {
    return NextResponse.json(
      { error: "sellerId query parameter is required." },
      { status: 400 },
    );
  }

  try {
    const items = await listItemsBySeller(sellerId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to load items", error);
    return NextResponse.json(
      { error: "Unable to load items right now. Please try again later." },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const itemId = payload?.id ?? payload?.itemId ?? payload?.item_id;
  if (!itemId) {
    return NextResponse.json({ error: "id is required to update an item." }, { status: 400 });
  }

  const patch = {};
  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.type !== undefined) patch.type = payload.type;
  if (payload.quantity !== undefined) patch.quantity = Number(payload.quantity);
  if (payload.expiryDate !== undefined || payload.expiry_date !== undefined) {
    patch.expiryDate = payload.expiryDate ?? payload.expiry_date;
  }
  if (payload.dateOfPurchase !== undefined || payload.date_of_purchase !== undefined) {
    patch.dateOfPurchase = payload.dateOfPurchase ?? payload.date_of_purchase;
  }
  if (payload.price !== undefined) patch.price = payload.price;
  if (payload.imagePath !== undefined || payload.image_path !== undefined) {
    patch.imagePath = payload.imagePath ?? payload.image_path;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one field to update." },
      { status: 400 },
    );
  }

  try {
    const item = await updateItem(itemId, patch);
    return NextResponse.json({ item });
  } catch (error) {
    console.error("Failed to update item", error);
    return NextResponse.json(
      { error: "Unable to update item right now. Please try again later." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const submission = {
    sellerId: payload.sellerId ?? payload.seller_id,
    type: payload.type ?? "inventory",
    name: payload.name,
    expiryDate: payload.expiryDate ?? payload.expiry_date ?? null,
    dateOfPurchase: payload.dateOfPurchase ?? payload.date_of_purchase ?? null,
    price: payload.price,
    quantity: payload.quantity,
    imagePath: payload.imagePath ?? payload.image_path ?? null,
  };

  const validationErrors = validateItemInput(submission);
  if (Object.keys(validationErrors).length > 0) {
    return NextResponse.json(
      { error: "Invalid input provided.", details: validationErrors },
      { status: 400 },
    );
  }

  try {
    const item = await createItem(submission);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Failed to create item", error);
    return NextResponse.json(
      { error: "Unable to save item right now. Please try again later." },
      { status: 500 },
    );
  }
}
