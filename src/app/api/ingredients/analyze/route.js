import { NextResponse } from "next/server";
import { generateIngredientsFromImage } from "@/lib/ai";
import { getItemById, listItemsBySeller } from "@/lib/items";

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const itemId = payload?.itemId ?? payload?.item_id ?? null;
  const overrideImageUrl = payload?.imageUrl ?? payload?.image_url ?? null;
  const userNotes = payload?.notes ?? null;
  const sellerId =
    payload?.sellerId ??
    payload?.seller_id ??
    null;

  if (!itemId && !overrideImageUrl) {
    return NextResponse.json(
      { error: "Provide either itemId or imageUrl to analyze ingredients." },
      { status: 400 },
    );
  }

  let imageUrl = overrideImageUrl;
  let itemRecord = null;
  if (itemId) {
    itemRecord = await getItemById(itemId);
    if (!itemRecord) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
    imageUrl = imageUrl ?? itemRecord.imagePath;
  }

  const ownerId = sellerId ?? itemRecord?.sellerId ?? null;
  if (!ownerId) {
    return NextResponse.json(
      { error: "sellerId is required when imageUrl is supplied directly." },
      { status: 400 },
    );
  }

  if (!imageUrl) {
    return NextResponse.json(
      { error: "No image URL available. Upload an image or provide imageUrl directly." },
      { status: 400 },
    );
  }

  try {
    const inventory = await listItemsBySeller(ownerId);
    const aiResult = await generateIngredientsFromImage(imageUrl, {
      notes: userNotes ?? null,
      inventoryNames: inventory.map((item) => item.name),
    });

    const matchedIngredients = mapIngredientsToInventory(aiResult.ingredients, inventory);

    return NextResponse.json({
      ai: aiResult,
      item: itemRecord ?? null,
      ingredients: matchedIngredients,
    });
  } catch (error) {
    console.error("Failed to analyze ingredients", error);
    return NextResponse.json(
      { error: "Unable to analyze ingredients right now. Please try again later." },
      { status: 500 },
    );
  }
}

function normalizeName(value) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

function parseNumericFromText(text) {
  if (!text) return NaN;
  const match = text.match(/[\d.]+/);
  if (!match) return NaN;
  return Number.parseFloat(match[0]);
}

function clampQuantity(suggested, availableRaw) {
  if (availableRaw === null || availableRaw === undefined) {
    return { used: null, available: null, suggested };
  }

  const available = Number(availableRaw);
  if (Number.isNaN(available)) {
    return { used: null, available: null, suggested };
  }

  const parsed = parseNumericFromText(suggested);
  if (Number.isNaN(parsed)) {
    return { used: available, available, suggested };
  }

  const limited = Math.min(parsed, available);
  return { used: Number(limited.toFixed(2)), available, suggested };
}

function mapIngredientsToInventory(aiIngredients = [], inventory = []) {
  if (!Array.isArray(aiIngredients) || aiIngredients.length === 0) return [];
  if (!Array.isArray(inventory) || inventory.length === 0) return [];

  const normalizedInventory = inventory.map((item) => ({
    ...item,
    normalizedName: normalizeName(item.name),
  }));

  return aiIngredients
    .map((ingredient) => {
      const normalizedIngredient = normalizeName(ingredient?.name);
      if (!normalizedIngredient) return null;

      const match =
        normalizedInventory.find((item) =>
          normalizedIngredient.includes(item.normalizedName),
        ) ??
        normalizedInventory.find((item) =>
          item.normalizedName.includes(normalizedIngredient),
        );

      if (!match) return null;

      const quantity = clampQuantity(ingredient?.quantity ?? null, match.quantity ?? null);

      return {
        itemId: match.id,
        itemName: match.name,
        aiName: ingredient?.name ?? null,
        quantity: quantity.used,
        availableQuantity: quantity.available,
        suggestedQuantity: quantity.suggested ?? null,
      };
    })
    .filter(Boolean);
}
