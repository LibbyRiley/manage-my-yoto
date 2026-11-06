import { NextRequest, NextResponse } from "next/server";
import { getYotoToken } from "@/lib/yoto-session";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  // Only proxy Yoto API URLs
  if (!url.startsWith("https://api.yotoplay.com/")) {
    return NextResponse.redirect(url);
  }

  const token = getYotoToken();
  if (!token) return new NextResponse("Not authenticated", { status: 401 });

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return new NextResponse("Upstream error", { status: res.status });

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = await res.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
