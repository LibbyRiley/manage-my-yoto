import { NextResponse } from "next/server";
import { getYotoToken } from "@/lib/yoto-session";

export async function GET() {
  const token = getYotoToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let res: Response;
  try {
    res = await fetch("https://api.yotoplay.com/media/displayIcons/user/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    return NextResponse.json({ error: "Upstream request failed" }, { status: 500 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: "Upstream error" }, { status: 500 });
  }

  const data = await res.json() as {
    displayIcons: { displayIconId: string; mediaId: string; url: string; createdAt: string }[];
  };

  return NextResponse.json({
    icons: data.displayIcons.map(({ displayIconId, mediaId, url, createdAt }) => ({
      displayIconId,
      mediaId: mediaId ?? displayIconId,
      url,
      createdAt,
    })),
  });
}
