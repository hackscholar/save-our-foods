import { NextResponse } from "next/server";
import { validateLoginInput, verifyUserCredentials } from "@/lib/users";
import crypto from "crypto";

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const submission = {
    email: String(payload?.email ?? "").trim().toLowerCase(),
    password: String(payload?.password ?? ""),
  };

  const validationErrors = validateLoginInput(submission);
  if (Object.keys(validationErrors).length > 0) {
    return NextResponse.json(
      { error: "Invalid input provided.", details: validationErrors },
      { status: 400 },
    );
  }

  const user = await verifyUserCredentials(submission.email, submission.password);
  if (!user) {
    return NextResponse.json(
      { error: "Email or password is incorrect." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    user,
    sessionToken: crypto.randomUUID(),
  });
}
