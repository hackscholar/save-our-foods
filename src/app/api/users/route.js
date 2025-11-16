import { NextResponse } from "next/server";
import { getAllUsers } from "@/lib/users";

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

