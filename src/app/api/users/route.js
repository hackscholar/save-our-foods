import { NextResponse } from "next/server";
import {
  getAllUsers,
  updateUserProfile,
  validateProfileUpdateInput,
} from "@/lib/users";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("perPage") || "1000", 10);

    const result = await getAllUsers({ page, perPage });

    return NextResponse.json({
      users: result.users,
      total: result.total,
      page,
      perPage,
    });
  } catch (error) {
    console.error("Failed to fetch users", error);
    console.error("Error details:", error.message, error.stack);
    return NextResponse.json(
      { 
        error: "Unable to fetch users right now. Please try again later.",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const userId = String(payload?.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json(
      { error: "User ID is required." },
      { status: 400 },
    );
  }

  const submission = {
    firstName: String(payload?.firstName ?? "").trim(),
    lastName: String(payload?.lastName ?? "").trim(),
    email: String(payload?.email ?? "").trim().toLowerCase(),
    phone: String(payload?.phone ?? "").trim(),
    password: String(payload?.password ?? ""),
  };

  const validationErrors = validateProfileUpdateInput(submission);
  if (Object.keys(validationErrors).length > 0) {
    return NextResponse.json(
      { error: "Invalid input provided.", details: validationErrors },
      { status: 400 },
    );
  }

  try {
    const user = await updateUserProfile(userId, submission);
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    if (error.code === "ACCOUNT_EXISTS") {
      return NextResponse.json(
        { error: "An account already exists for this email address." },
        { status: 409 },
      );
    }

    console.error("Failed to update user profile", error);
    return NextResponse.json(
      {
        error: "Unable to update profile right now. Please try again later.",
      },
      { status: 500 },
    );
  }
}
