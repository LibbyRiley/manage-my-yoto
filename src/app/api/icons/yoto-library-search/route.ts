import { NextRequest, NextResponse } from "next/server";
import { searchYotoLibraryByKeywords } from "@/lib/icons";

export async function POST(request: NextRequest) {
  try {
    const { keywords } = await request.json();
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "keywords array is required" }, { status: 400 });
    }
    const icons = await searchYotoLibraryByKeywords(keywords, 5);
    return NextResponse.json({ icons });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
