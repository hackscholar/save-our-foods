import { NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/notifications";

export async function PATCH(request, { params }) {
  const notificationId = params?.id ?? null;
  if (!notificationId) {
    return NextResponse.json(
      { error: "Notification ID is required." },
      { status: 400 },
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const readValue =
    typeof payload?.read === "boolean" ? payload.read : true;

  try {
    const notification = await markNotificationRead(notificationId, readValue);
    return NextResponse.json({ notification });
  } catch (error) {
    console.error("Failed to update notification", error);
    return NextResponse.json(
      { error: "Unable to update notification right now." },
      { status: 500 },
    );
  }
}
