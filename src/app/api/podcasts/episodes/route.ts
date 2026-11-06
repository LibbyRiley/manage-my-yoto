import { NextRequest, NextResponse } from "next/server";
import { parseRssFeed } from "@/lib/rss";

export async function GET(request: NextRequest) {
  const feedUrl = request.nextUrl.searchParams.get("feedUrl");

  if (!feedUrl) {
    return NextResponse.json(
      { error: "Feed URL is required" },
      { status: 400 }
    );
  }

  try {
    const { episodes, meta } = await parseRssFeed(feedUrl);
    return NextResponse.json({ episodes, ...meta });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to parse feed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
