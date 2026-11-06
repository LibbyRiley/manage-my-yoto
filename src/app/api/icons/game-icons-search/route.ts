import { NextRequest, NextResponse } from "next/server";
import { generateGameIcons } from "@/lib/game-icons";

// Simple in-memory cache so re-searching the same term doesn't re-fetch SVGs
const cache = new Map<string, { icons: unknown[]; ts: number }>();
const TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ icons: [] });

  const cached = cache.get(q);
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json({ icons: cached.icons });
  }

  const icons = await generateGameIcons(q, 12);
  cache.set(q, { icons, ts: Date.now() });
  return NextResponse.json({ icons });
}
