import { NextRequest, NextResponse } from "next/server";
import { getYotoToken } from "@/lib/yoto-session";

export async function POST(req: NextRequest) {
  const token = getYotoToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { imageDataUrl, imageUrl, filename } = await req.json() as {
    imageDataUrl?: string;
    imageUrl?: string;
    filename?: string;
  };

  let mimeType: string;
  let buffer: Buffer;

  if (imageUrl) {
    const fetchHeaders: Record<string, string> = {};
    if (imageUrl.startsWith("https://api.yotoplay.com/")) {
      fetchHeaders["Authorization"] = `Bearer ${token}`;
    }
    const fetched = await fetch(imageUrl, { headers: fetchHeaders });
    if (!fetched.ok) return NextResponse.json({ error: "Failed to fetch image URL" }, { status: 400 });
    mimeType = fetched.headers.get("content-type") ?? "image/jpeg";
    buffer = Buffer.from(await fetched.arrayBuffer());
  } else if (imageDataUrl) {
    const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: "Invalid imageDataUrl" }, { status: 400 });
    mimeType = match[1];
    buffer = Buffer.from(match[2], "base64");
  } else {
    return NextResponse.json({ error: "imageDataUrl or imageUrl required" }, { status: 400 });
  }

  const url = new URL("https://api.yotoplay.com/media/coverImage/user/me/upload");
  url.searchParams.set("coverType", "stories");
  if (filename) url.searchParams.set("filename", filename);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": mimeType,
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json() as { coverImage: { mediaId: string; mediaUrl: string } };
  return NextResponse.json({ mediaId: data.coverImage.mediaId, mediaUrl: data.coverImage.mediaUrl });
}
