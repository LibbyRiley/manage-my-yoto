import { NextRequest, NextResponse } from "next/server";
import { searchYotoIconsCom } from "@/lib/yotoicons-com";

const cache = new Map<string, { icons: unknown[]; ts: number }>();
const TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ icons: [] });

  const cached = cache.get(q);
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json({ icons: cached.icons });
  }

  const icons = await searchYotoIconsCom(q, 12);
  cache.set(q, { icons, ts: Date.now() });
  return NextResponse.json({ icons });
}
