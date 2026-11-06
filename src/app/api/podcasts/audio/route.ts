import { NextRequest } from "next/server";
import { existsSync } from "fs";
import { readFile, stat } from "fs/promises";
import { ensureCached, trackRefPath, ensureYotoTrackCached } from "@/lib/audio-cache";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const audioUrl = req.nextUrl.searchParams.get("url");
  const trackRef = req.nextUrl.searchParams.get("ref");
  const cardId = req.nextUrl.searchParams.get("cardId");

  let path: string;
  try {
    if (trackRef) {
      const refPath = trackRefPath(trackRef);
      if (!refPath) return new Response("Bad ref", { status: 400 });
      if (existsSync(refPath)) {
        path = refPath;
      } else if (cardId) {
        path = await ensureYotoTrackCached(trackRef, cardId, req.signal);
      } else {
        return new Response("Track not in local cache (provide cardId to resolve via Yoto)", { status: 404 });
      }
    } else if (audioUrl) {
      path = await ensureCached(audioUrl, req.signal);
    } else {
      return new Response("Missing url or ref param", { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return new Response(message, { status: 502 });
  }

  const total = (await stat(path)).size;
  const buf = await readFile(path);
  const range = req.headers.get("range");
  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : total - 1;
      const slice = buf.subarray(start, end + 1);
      return new Response(new Uint8Array(slice), {
        status: 206,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(slice.length),
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
