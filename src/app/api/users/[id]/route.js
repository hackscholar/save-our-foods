import { NextResponse } from "next/server";
import { getUserById } from "@/lib/users";

export async function GET(_request, { params }) {
  const userId = params?.id;
  if (!userId) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Failed to load user", error);
    return NextResponse.json(
      { error: "Unable to fetch user right now. Please try again later." },
      { status: 500 },
    );
  }
}

