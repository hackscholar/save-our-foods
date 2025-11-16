import { NextResponse } from "next/server";
import { createItem, validateItemInput, listItemsBySeller } from "@/lib/items";

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
