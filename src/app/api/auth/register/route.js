import { NextResponse } from "next/server";
import { createUser, validateRegistrationInput } from "@/lib/users";

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const submission = {
    name: String(payload?.name ?? "").trim(),
    email: String(payload?.email ?? "").trim().toLowerCase(),
    password: String(payload?.password ?? ""),
  };

  const validationErrors = validateRegistrationInput(submission);
  if (Object.keys(validationErrors).length > 0) {
    return NextResponse.json(
      { error: "Invalid input provided.", details: validationErrors },
      { status: 400 },
    );
  }

  try {
    const user = await createUser(submission);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error.code === "ACCOUNT_EXISTS") {
      return NextResponse.json(
        { error: "An account already exists for this email address." },
        { status: 409 },
      );
    }

    console.error("Failed to create user account", error);
    return NextResponse.json(
      { error: "Unable to create account right now. Please try again later." },
      { status: 500 },
    );
  }
}
