import { getSupabaseServiceClient } from "@/lib/supabase";

const ITEMS_TABLE = "items";
const ITEM_TYPES = ["inventory", "marketplace"];

function isNumericValue(value) {
  return typeof value === "number" || (typeof value === "string" && value.trim() !== "");
}

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return NaN;
}

export function validateItemInput(payload = {}) {
  const issues = {};

  if (payload.name && payload.name.trim().length < 2) {
    issues.name = "Name must be at least 2 characters long.";
  }

  if (!payload.sellerId || typeof payload.sellerId !== "string") {
    issues.sellerId = "sellerId is required.";
  }

  if (payload.type && !ITEM_TYPES.includes(payload.type)) {
    issues.type = `type must be one of: ${ITEM_TYPES.join(", ")}.`;
  }

  if (payload.price !== undefined && payload.price !== null) {
    if (!isNumericValue(payload.price) || Number(payload.price) < 0) {
      issues.price = "price must be a positive number.";
    }
  }

  if (payload.quantity === undefined || payload.quantity === null) {
    issues.quantity = "quantity is required.";
  } else if (!Number.isInteger(Number(payload.quantity)) || Number(payload.quantity) < 0) {
    issues.quantity = "quantity must be a non-negative integer.";
  }

  if (payload.expiryDate && Number.isNaN(Date.parse(payload.expiryDate))) {
    issues.expiryDate = "expiryDate must be a valid date.";
  }

  if (payload.dateOfPurchase && Number.isNaN(Date.parse(payload.dateOfPurchase))) {
    issues.dateOfPurchase = "dateOfPurchase must be a valid date.";
  }

  return issues;
}

export async function createItem(payload) {
  const supabase = getSupabaseServiceClient();
  const data = {
    seller_id: payload.sellerId,
    type: payload.type ?? "inventory",
    name: payload.name?.trim() || "Pending classification",
    expiry_date: payload.expiryDate ?? null,
    date_of_purchase: payload.dateOfPurchase ?? null,
    price:
      payload.price !== undefined && payload.price !== null ? toNumber(payload.price) : null,
    quantity: Number(payload.quantity),
    image_path: payload.imagePath ?? null,
  };

  const { data: inserted, error } = await supabase
    .from(ITEMS_TABLE)
    .insert(data)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return formatItem(inserted);
}

export async function getItemById(itemId) {
  if (!itemId) return null;
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(ITEMS_TABLE)
    .select("*")
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? formatItem(data) : null;
}

export async function updateItem(itemId, patch = {}) {
  const supabase = getSupabaseServiceClient();
  const updatePayload = {};

  if (patch.name !== undefined) updatePayload.name = patch.name;
  if (patch.type !== undefined) updatePayload.type = patch.type;
  if (patch.expiryDate !== undefined) updatePayload.expiry_date = patch.expiryDate;
  if (patch.dateOfPurchase !== undefined) updatePayload.date_of_purchase = patch.dateOfPurchase;
  if (patch.price !== undefined) updatePayload.price = patch.price;
  if (patch.quantity !== undefined) updatePayload.quantity = patch.quantity;
  if (patch.imagePath !== undefined) updatePayload.image_path = patch.imagePath;

  if (Object.keys(updatePayload).length === 0) {
    throw new Error("No valid fields provided to update item.");
  }

  const { data, error } = await supabase
    .from(ITEMS_TABLE)
    .update(updatePayload)
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return formatItem(data);
}

export async function listItemsBySeller(sellerId) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from(ITEMS_TABLE)
    .select("*")
    .eq("seller_id", sellerId);

  if (error) {
    throw error;
  }

  return (data ?? []).map(formatItem);
}

export function formatItem(record) {
  if (!record) return null;
  return {
    id: record.id,
    sellerId: record.seller_id,
    type: record.type,
    name: record.name,
    expiryDate: record.expiry_date,
    dateOfPurchase: record.date_of_purchase,
    price: record.price,
    quantity: record.quantity,
    imagePath: record.image_path,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
