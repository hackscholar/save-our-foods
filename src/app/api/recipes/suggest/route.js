import { NextResponse } from "next/server";
import { listItemsBySeller } from "@/lib/items";
import { generateRecipeFromInventory } from "@/lib/ai";

function sortByExpiryAscending(items = []) {
  return [...items].sort((a, b) => {
    const getTime = (value) => {
      if (!value) return Infinity;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? Infinity : time;
    };
    return getTime(a.expiryDate) - getTime(b.expiryDate);
  });
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sellerId = payload?.sellerId ?? payload?.seller_id ?? null;
  const limitRaw = payload?.maxIngredients ?? payload?.limit ?? 8;
  const limit = Number(limitRaw);

  if (!sellerId) {
    return NextResponse.json({ error: "sellerId is required." }, { status: 400 });
  }

  let inventory = await listItemsBySeller(sellerId, "inventory");
  inventory = inventory
    .filter((item) => (item.quantity ?? 0) > 0)
    .filter((item) => item.name);

  if (inventory.length === 0) {
    return NextResponse.json(
      { error: "No groceries available to suggest a recipe.", recipe: null },
      { status: 404 },
    );
  }

  const prioritized = sortByExpiryAscending(inventory).slice(0, Number.isNaN(limit) ? 8 : limit);

  try {
    const recipe = await generateRecipeFromInventory({ items: prioritized });
    return NextResponse.json({ recipe });
  } catch (error) {
    console.error("Failed to generate recipe suggestion", error);
    return NextResponse.json(
      { error: "Unable to create a recipe suggestion right now." },
      { status: 500 },
    );
  }
}
