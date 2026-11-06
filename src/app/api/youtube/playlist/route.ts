import { NextRequest, NextResponse } from "next/server";
import ytpl from "@distube/ytpl";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  try {
    const playlist = await ytpl(url, { limit: Infinity });
    return NextResponse.json({
      title: playlist.title,
      author: playlist.author?.name ?? "",
      videos: playlist.items.map((item) => ({
        id: item.id,
        title: item.title,
        duration: item.duration ?? "",
        thumbnail: item.thumbnail ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch playlist" },
      { status: 500 }
    );
  }
}
