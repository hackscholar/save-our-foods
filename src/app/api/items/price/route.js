import { NextResponse } from "next/server";
import { generatePriceSuggestion } from "@/lib/ai";

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = payload?.name ?? "";
  if (!name.trim()) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  try {
    const suggestion = await generatePriceSuggestion({
      name: name.trim(),
      quantity: payload?.quantity ?? null,
      expiryDate: payload?.expiryDate ?? payload?.expiry_date ?? null,
      dateOfPurchase: payload?.dateOfPurchase ?? payload?.date_of_purchase ?? null,
    });

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("Failed to generate price suggestion", error);
    return NextResponse.json(
      { error: "Unable to estimate price right now. Please try again later." },
      { status: 500 },
    );
  }
}
