import crypto from "crypto";
import { existsSync } from "fs";
import { mkdir, writeFile, stat } from "fs/promises";
import { join } from "path";
import { getYotoToken } from "./yoto-session";

const CACHE_DIR = join(process.cwd(), "downloads", "audio-cache");

export function cacheKeyFor(audioUrl: string): string {
  return crypto.createHash("sha256").update(audioUrl).digest("hex").slice(0, 16);
}

export function cachePath(audioUrl: string): string {
  return join(CACHE_DIR, `${cacheKeyFor(audioUrl)}.mp3`);
}

/**
 * Ensures the audio at `audioUrl` is cached locally and returns the local path.
 * Subsequent calls with the same URL return the cached path without re-fetching.
 *
 * This is critical for podcast feeds with dynamic ad insertion (DAI), where each
 * fetch of the same URL returns a *different* MP3. Caching ensures the audio the
 * user previews in the browser is identical to the audio the server trims/uploads.
 */
export async function ensureCached(audioUrl: string, signal?: AbortSignal): Promise<string> {
  const path = cachePath(audioUrl);
  if (existsSync(path)) {
    const s = await stat(path);
    if (s.size > 0) return path;
  }
  await mkdir(CACHE_DIR, { recursive: true });
  console.log(`[audio-cache] fetching ${audioUrl}`);
  const t0 = Date.now();
  const res = await fetch(audioUrl, { redirect: "follow", signal });
  if (!res.ok) throw new Error(`Upstream returned ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path, buf);
  console.log(`[audio-cache] cached ${(buf.length / 1024 / 1024).toFixed(1)}MB to ${path} (${Date.now() - t0}ms)`);
  return path;
}

/**
 * Returns the cache path for a Yoto track reference (`yoto:#<sha>`), or null
 * if the input isn't a yoto reference. The path may or may not exist on disk.
 */
export function trackRefPath(trackRef: string): string | null {
  if (!trackRef.startsWith("yoto:#")) return null;
  const sha = trackRef.slice(6).replace(/[^a-zA-Z0-9]/g, "");
  if (!sha) return null;
  return join(CACHE_DIR, `track-${sha}.mp3`);
}

/** Saves the post-trim/post-upload bytes to disk keyed by yoto:# track reference. */
export async function saveTrackRefCache(trackRef: string, buffer: Buffer): Promise<void> {
  const path = trackRefPath(trackRef);
  if (!path) return;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path, buffer);
  console.log(`[audio-cache] saved track-ref cache for ${trackRef.slice(0, 18)}… (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
}

/**
 * Ensures a yoto:#<sha> track is cached locally, fetching from Yoto's CDN if not.
 *
 * 1. If `track-<sha>.mp3` exists locally, return it (cache hit).
 * 2. Otherwise resolve the sha to a signed CDN URL via Yoto's
 *    `GET /card/{cardId}/media/{sha}` endpoint, fetch the bytes, save them, return the path.
 *
 * Throws if not authenticated or if Yoto's resolve/CDN fetch fails.
 */
export async function ensureYotoTrackCached(trackRef: string, cardId: string, signal?: AbortSignal): Promise<string> {
  const path = trackRefPath(trackRef);
  if (!path) throw new Error("Not a yoto:# reference");
  if (existsSync(path)) {
    const s = await stat(path);
    if (s.size > 0) return path;
  }

  const sha = trackRef.slice(6).replace(/[^a-zA-Z0-9]/g, "");
  const token = getYotoToken();
  if (!token) throw new Error("Not authenticated with Yoto");

  console.log(`[audio-cache] resolving yoto track ${sha.slice(0, 12)}… for card ${cardId.slice(0, 12)}…`);
  const t0 = Date.now();
  const resolveRes = await fetch(`https://api.yotoplay.com/card/${cardId}/media/${sha}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!resolveRes.ok) {
    const body = await resolveRes.text().catch(() => "");
    throw new Error(`Yoto track resolution failed: ${resolveRes.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }
  const data = await resolveRes.json() as { media?: { url?: string }; url?: string };
  const url = data.media?.url ?? data.url;
  if (!url) throw new Error("Yoto track resolution returned no URL");

  const cdnRes = await fetch(url, { signal });
  if (!cdnRes.ok) throw new Error(`Yoto CDN fetch failed: ${cdnRes.status}`);
  const buf = Buffer.from(await cdnRes.arrayBuffer());
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path, buf);
  console.log(`[audio-cache] cached ${(buf.length / 1024 / 1024).toFixed(1)}MB from Yoto CDN to ${path} (${Date.now() - t0}ms)`);
  return path;
}
