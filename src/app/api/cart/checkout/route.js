import { NextResponse } from "next/server";
import { getUserById } from "@/lib/users";
import { generateCartInvoice } from "@/lib/pdf";

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
  }

  let buyerEmail = payload?.buyerEmail ?? null;
  let buyerName = payload?.buyerName ?? null;

  if (!buyerEmail && payload?.buyerId) {
    const user = await getUserById(payload.buyerId);
    buyerEmail = user?.email ?? null;
    buyerName = buyerName ?? user?.name ?? null;
  }

  if (!buyerEmail) {
    return NextResponse.json({ error: "buyerEmail is required." }, { status: 400 });
  }

  try {
    const pdfBuffer = await generateCartInvoice({
      buyerEmail,
      buyerName,
      items,
    });

    return NextResponse.json({
      success: true,
      pdf: pdfBuffer.toString("base64"),
      fileName: "saveourfoods-receipt.pdf",
    });
  } catch (error) {
    console.error("Failed to generate cart invoice", error);
    return NextResponse.json(
      { error: "Unable to generate cart invoice right now. Please try again later." },
      { status: 500 },
    );
  }
}
