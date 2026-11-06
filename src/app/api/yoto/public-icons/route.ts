import { NextResponse } from "next/server";
import { getYotoToken } from "@/lib/yoto-session";

export async function GET() {
  const token = getYotoToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const res = await fetch("https://api.yotoplay.com/media/displayIcons/user/yoto", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Yoto API error: ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  const icons = (data.displayIcons ?? []).map((ic: {
    displayIconId: string;
    mediaId: string;
    title: string;
    url: string;
    publicTags?: string[];
  }) => ({
    displayIconId: ic.displayIconId,
    mediaId: ic.mediaId ?? ic.displayIconId,
    title: ic.title ?? "",
    url: ic.url ?? "",
    tags: ic.publicTags ?? [],
  }));

  return NextResponse.json({ icons });
}
