import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { getSupabaseServiceClient } from "@/lib/supabase";

const DEFAULT_WINDOW_HOURS =
  Number(process.env.EXPIRY_ALERT_WINDOW_HOURS ?? 48) || 48;

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const header = request.headers.get("x-cron-secret");
  return header === cronSecret;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const now = new Date();
  const cutoff = new Date(
    now.getTime() + DEFAULT_WINDOW_HOURS * 60 * 60 * 1000,
  );

  const { data: items, error } = await supabase
    .from("items")
    .select("id, name, seller_id, expiry_date, quantity, price")
    .not("expiry_date", "is", null)
    .gte("expiry_date", now.toISOString())
    .lte("expiry_date", cutoff.toISOString());

  if (error) {
    console.error("Failed to load expiring items", error);
    return NextResponse.json(
      { error: "Unable to check for expiring items." },
      { status: 500 },
    );
  }

  if (!items?.length) {
    return NextResponse.json({
      success: true,
      checked: 0,
      created: 0,
    });
  }

  const sellerIds = Array.from(
    new Set(items.map((item) => item.seller_id).filter(Boolean)),
  );

  let existingNotifications = [];
  if (sellerIds.length > 0) {
    const { data: existing, error: existingError } = await supabase
      .from("notifications")
      .select("payload")
      .eq("type", "expiry_alert")
      .in("user_id", sellerIds);

    if (existingError) {
      console.error("Failed to load existing expiry alerts", existingError);
      return NextResponse.json(
        { error: "Unable to check for duplicate expiry alerts." },
        { status: 500 },
      );
    }

    existingNotifications = existing ?? [];
  }

  const notifiedItemIds = new Set(
    existingNotifications
      .map((record) => record.payload?.itemId)
      .filter(Boolean),
  );

  const pendingItems = items.filter(
    (item) => item.seller_id && !notifiedItemIds.has(item.id),
  );

  if (!pendingItems.length) {
    return NextResponse.json({
      success: true,
      checked: items.length,
      created: 0,
    });
  }

  const notifications = [];
  for (const item of pendingItems) {
    const expiresAt = new Date(item.expiry_date);
    const hoursUntilExpiry = Math.max(
      0,
      Math.round((expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000)),
    );
    try {
      const created = await createNotification({
        userId: item.seller_id,
        type: "expiry_alert",
        payload: {
          itemId: item.id,
          itemName: item.name,
          expiryDate: item.expiry_date,
          quantity: item.quantity,
          price: item.price,
          expiresInHours: hoursUntilExpiry,
        },
      });
      notifications.push(created);
    } catch (notificationError) {
      console.error(
        `Failed to create expiry notification for item ${item.id}`,
        notificationError,
      );
    }
  }

  return NextResponse.json({
    success: true,
    checked: items.length,
    created: notifications.length,
  });
}
