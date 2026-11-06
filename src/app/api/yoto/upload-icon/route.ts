import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import crypto from "crypto";
import path from "path";
import { getYotoToken } from "@/lib/yoto-session";

const CACHE_FILE = path.join(process.cwd(), ".yoto-icon-cache.json");
let memCache: Record<string, string> | null = null;

async function readCache(): Promise<Record<string, string>> {
  if (memCache) return memCache;
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    memCache = JSON.parse(raw);
  } catch {
    memCache = {};
  }
  return memCache!;
}

async function writeCache(c: Record<string, string>): Promise<void> {
  memCache = c;
  await writeFile(CACHE_FILE, JSON.stringify(c), "utf-8").catch(() => {});
}

// When Yoto returns {mediaId:null} (duplicate), search My Icons by comparing image content.
// Caches the result so this only runs once per unrecognised icon.
async function findExistingIconByContent(
  token: string,
  buffer: Buffer,
  cache: Record<string, string>,
  hash: string
): Promise<string | null> {
  const listRes = await fetch(
    "https://api.yotoplay.com/media/displayIcons/user/me",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) return null;

  const { displayIcons = [] } = await listRes.json() as {
    displayIcons: { mediaId?: string; displayIconId?: string; url?: string }[];
  };

  console.log(`[upload-icon] duplicate detected, searching ${displayIcons.length} My Icons by pixel content`);;

  // Decode our uploaded image to raw pixels for comparison
  const sharp = (await import("sharp")).default;
  const ourPixels = await sharp(buffer).resize(16, 16).raw().toBuffer();

  const results = await Promise.allSettled(
    displayIcons.map(async (ic) => {
      const mediaId = ic.mediaId ?? ic.displayIconId;
      if (!mediaId || !ic.url) return null;
      try {
        const imgRes = await fetch(ic.url, { signal: AbortSignal.timeout(5000) });
        if (!imgRes.ok) return null;
        const imgBuf = Buffer.from(await imgRes.arrayBuffer());

        // Try byte comparison first (fast)
        if (imgBuf.equals(buffer)) return mediaId;

        // Fall back to pixel comparison (handles re-encoding by Yoto)
        const theirPixels = await sharp(imgBuf).resize(16, 16).raw().toBuffer();
        return theirPixels.equals(ourPixels) ? mediaId : null;
      } catch {
        return null;
      }
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      console.log(`[upload-icon] found match: ${r.value}`);
      cache[hash] = r.value;
      await writeCache(cache);
      return r.value;
    }
  }

  console.log("[upload-icon] no matching icon found in My Icons");
  return null;
}

export async function POST(req: NextRequest) {
  const token = getYotoToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated with Yoto" }, { status: 401 });
  }

  const { imageDataUrl, sourceUrl, filename } = await req.json() as {
    imageDataUrl?: string;
    sourceUrl?: string;
    filename?: string;
  };

  let buffer: Buffer;
  let mimeType: string;

  if (sourceUrl) {
    // Upload original source image — Yoto's autoConvert will process it consistently,
    // enabling reliable duplicate detection for icons already in My Icons.
    const imgRes = await fetch(sourceUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: `Failed to fetch source image: ${imgRes.status}` }, { status: 400 });
    }
    mimeType = imgRes.headers.get("content-type") || "image/png";
    buffer = Buffer.from(await imgRes.arrayBuffer());
  } else if (imageDataUrl) {
    const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Invalid imageDataUrl" }, { status: 400 });
    }
    mimeType = match[1];
    buffer = Buffer.from(match[2], "base64");
  } else {
    return NextResponse.json({ error: "Either sourceUrl or imageDataUrl is required" }, { status: 400 });
  }
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  const cache = await readCache();

  // Fast path: we've seen this image before
  if (cache[hash]) {
    return NextResponse.json({ mediaId: cache[hash] });
  }

  const url = new URL("https://api.yotoplay.com/media/displayIcons/user/me/upload");
  url.searchParams.set("autoConvert", "true");
  if (filename) url.searchParams.set("filename", filename);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": mimeType },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const raw = await res.json() as Record<string, unknown>;
  const mediaId = (raw.mediaId ?? raw.displayIconId ?? null) as string | null;

  if (mediaId) {
    // Fresh upload — cache and return
    cache[hash] = mediaId;
    await writeCache(cache);
    return NextResponse.json({ mediaId });
  }

  // Yoto returned {} — icon already exists but won't tell us which one.
  // Search My Icons by comparing image content.
  const found = await findExistingIconByContent(token, buffer, cache, hash);
  return NextResponse.json({ mediaId: found });
}
