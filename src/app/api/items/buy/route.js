import { NextResponse } from "next/server";
import { getItemById } from "@/lib/items";
import { getUserById } from "@/lib/users";
import { createNotification } from "@/lib/notifications";

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const itemId = payload?.itemId ?? payload?.item_id ?? null;
  const buyerId = payload?.buyerId ?? payload?.buyer_id ?? null;

  if (!itemId) {
    return NextResponse.json(
      { error: "itemId is required." },
      { status: 400 },
    );
  }

  if (!buyerId) {
    return NextResponse.json(
      { error: "buyerId is required." },
      { status: 400 },
    );
  }

  try {
    // Get the item details
    const item = await getItemById(itemId);
    if (!item) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    // Get seller information
    const seller = await getUserById(item.sellerId);
    if (!seller) {
      return NextResponse.json(
        { error: "Seller not found." },
        { status: 404 },
      );
    }

    if (!seller.email) {
      return NextResponse.json(
        { error: "Seller email not available." },
        { status: 400 },
      );
    }

    // Get buyer information
    const buyer = await getUserById(buyerId);
    if (!buyer) {
      return NextResponse.json(
        { error: "Buyer not found." },
        { status: 404 },
      );
    }

    // Prevent users from buying their own items
    if (item.sellerId === buyerId) {
      return NextResponse.json(
        { error: "You cannot purchase your own item." },
        { status: 400 },
      );
    }

    let notificationRecord = null;

    try {
      notificationRecord = await createNotification({
        userId: seller.id,
        type: "purchase_request",
        payload: {
          itemId: item.id,
          itemName: item.name,
          itemPrice: item.price,
          itemQuantity: item.quantity,
          buyerId: buyer.id,
          buyerName: buyer.name || buyer.firstName || "Buyer",
          buyerEmail: buyer.email || null,
        },
      });
    } catch (notificationError) {
      console.error("Failed to log realtime notification:", notificationError);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Purchase request sent successfully. The seller will see it in their alerts.",
        item: {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        },
        seller: {
          id: seller.id,
          name: seller.name,
          email: seller.email,
        },
        buyer: {
          id: buyer.id,
          name: buyer.name,
          email: buyer.email,
        },
        notification: notificationRecord,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to process purchase request", error);
    return NextResponse.json(
      { error: "Unable to process purchase request right now. Please try again later." },
      { status: 500 },
    );
  }
}

