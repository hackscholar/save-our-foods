import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { randomUUID } from "crypto";

const BUCKET = process.env.SUPABASE_PRODUCT_IMAGES_BUCKET ?? "product_images";

export async function POST(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");
  const sellerId = (formData.get("sellerId") ?? "anonymous").toString();

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const extension = file.name?.split(".").pop() ?? "jpg";
  const objectName = `${sellerId}/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectName, buffer, {
      contentType: file.type ?? "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    console.error("Failed to upload file to Supabase Storage", uploadError);
    return NextResponse.json(
      { error: "Unable to upload image right now. Please try again later." },
      { status: 500 },
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectName);

  return NextResponse.json({
    path: objectName,
    publicUrl: data?.publicUrl ?? null,
  });
}
