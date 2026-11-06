import { NextRequest, NextResponse } from "next/server";
import { findIconsForEpisode } from "@/lib/icons";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { episodeTitle, artworkUrl } = body;

    if (!episodeTitle) {
      return NextResponse.json(
        { error: "Episode title is required" },
        { status: 400 }
      );
    }

    const icons = await findIconsForEpisode(episodeTitle, artworkUrl);
    return NextResponse.json({ icons });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Icon search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
