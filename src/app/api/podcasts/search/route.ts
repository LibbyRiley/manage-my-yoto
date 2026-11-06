import { NextRequest, NextResponse } from "next/server";
import { searchPodcasts } from "@/lib/podcastindex";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 }
    );
  }

  try {
    const podcasts = await searchPodcasts(query.trim());
    return NextResponse.json({ podcasts });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
