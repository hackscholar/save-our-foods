import { NextResponse } from "next/server";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
} from "@/lib/notifications";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "userId query parameter is required." },
      { status: 400 },
    );
  }

  const limitParam = searchParams.get("limit");
  const parsedLimit = limitParam ? Number(limitParam) : undefined;
  const options = {};
  if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
    options.limit = Math.min(parsedLimit, 200);
  }

  try {
    const notifications = await listNotificationsForUser(userId, options);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Failed to load notifications", error);
    return NextResponse.json(
      { error: "Unable to load notifications right now." },
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

  const userId = payload?.userId ?? null;
  if (!userId) {
    return NextResponse.json(
      { error: "userId is required." },
      { status: 400 },
    );
  }

  try {
    const result = await markAllNotificationsRead(userId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Failed to update notifications", error);
    return NextResponse.json(
      { error: "Unable to update notifications right now." },
      { status: 500 },
    );
  }
}
