import { getSupabaseServiceClient } from "@/lib/supabase";

const NOTIFICATIONS_TABLE = "notifications";
const DEFAULT_LIMIT = 50;

export function formatNotification(record) {
  if (!record) return null;
  return {
    id: record.id,
    userId: record.user_id,
    type: record.type,
    payload: record.payload ?? {},
    read: Boolean(record.read),
    createdAt: record.created_at,
    readAt: record.read_at,
  };
}

export async function createNotification({ userId, type, payload = {} }) {
  if (!userId) {
    throw new Error("userId is required to create a notification.");
  }
  if (!type) {
    throw new Error("type is required to create a notification.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .insert({
      user_id: userId,
      type,
      payload,
      read: false,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return formatNotification(data);
}

export async function listNotificationsForUser(
  userId,
  { limit = DEFAULT_LIMIT } = {},
) {
  if (!userId) return [];

  const supabase = getSupabaseServiceClient();
  let query = supabase
    .from(NOTIFICATIONS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (limit) {
    query = query.limit(Number(limit));
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(formatNotification);
}

export async function markNotificationRead(notificationId, read = true) {
  if (!notificationId) {
    throw new Error("notificationId is required to update notification.");
  }

  const supabase = getSupabaseServiceClient();
  const updates = {
    read,
    read_at: read ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .update(updates)
    .eq("id", notificationId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return formatNotification(data);
}

export async function markAllNotificationsRead(userId) {
  if (!userId) {
    throw new Error("userId is required to mark notifications as read.");
  }

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(NOTIFICATIONS_TABLE)
    .update({
      read: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("read", false)
    .select("id");

  if (error) {
    throw error;
  }

  return {
    updated: data?.length ?? 0,
  };
}
