import { NextResponse } from "next/server";
import { getItemById } from "@/lib/items";

export async function GET(_request, { params }) {
  const itemId = params?.id;
  if (!itemId) {
    return NextResponse.json({ error: "Item ID is required." }, { status: 400 });
  }

  try {
    const item = await getItemById(itemId);
    if (!item) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    console.error("Failed to fetch item", error);
    return NextResponse.json(
      { error: "Unable to fetch item right now. Please try again later." },
      { status: 500 },
    );
  }
}

