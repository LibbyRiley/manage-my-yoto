import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { stat, writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { ensureCached, trackRefPath, ensureYotoTrackCached } from "@/lib/audio-cache";

export const runtime = "nodejs";
export const maxDuration = 120;

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const DEFAULT_NOISE_DB = -18;
const DEFAULT_MIN_DURATION_S = 0.3;
const SILENCE_CACHE_DIR = join(process.cwd(), "downloads", "silence-cache");

interface SilenceRange { start: number; end: number }

function parseSilences(stderr: string): SilenceRange[] {
  const ranges: SilenceRange[] = [];
  let pendingStart: number | null = null;
  for (const line of stderr.split(/\r?\n/)) {
    const startMatch = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (startMatch) {
      pendingStart = Math.max(0, parseFloat(startMatch[1]));
      continue;
    }
    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (endMatch && pendingStart !== null) {
      const end = parseFloat(endMatch[1]);
      if (Number.isFinite(end) && end > pendingStart) ranges.push({ start: pendingStart, end });
      pendingStart = null;
    }
  }
  return ranges;
}

function detectSilences(inPath: string, noiseDb: number, minDurationS: number, signal?: AbortSignal): Promise<SilenceRange[]> {
  return new Promise((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-nostats",
      "-i", inPath,
      "-af", `silencedetect=noise=${noiseDb}dB:d=${minDurationS}`,
      "-f", "null",
      "-",
    ];
    const proc = spawn(FFMPEG, args);
    const stderr: string[] = [];
    proc.stderr.on("data", (d: Buffer) => stderr.push(d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve(parseSilences(stderr.join("")));
      else reject(new Error(stderr.slice(-3).join("").trim() || `ffmpeg exited with code ${code}`));
    });
    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") reject(Object.assign(new Error("ffmpeg not installed — run `brew install ffmpeg`"), { status: 503 }));
      else reject(new Error(`ffmpeg failed: ${err.message}`));
    });
    signal?.addEventListener("abort", () => { proc.kill(); reject(new Error("Aborted")); });
  });
}

function silenceCachePathFor(srcPath: string, noiseDb: number, minDurationS: number): string {
  // Cache key = the cached source filename + the silence config, so changing config re-runs.
  const base = srcPath.split("/").pop() ?? "unknown";
  const tag = `n${noiseDb}_d${minDurationS}`.replace(/\./g, "p").replace(/-/g, "m");
  return join(SILENCE_CACHE_DIR, `${base}__${tag}.json`);
}

export async function GET(req: NextRequest) {
  const audioUrl = req.nextUrl.searchParams.get("url");
  const trackRef = req.nextUrl.searchParams.get("ref");
  const cardId = req.nextUrl.searchParams.get("cardId");
  const noiseStr = req.nextUrl.searchParams.get("noise");
  const durStr = req.nextUrl.searchParams.get("dur");
  const noiseDb = noiseStr !== null && Number.isFinite(Number(noiseStr)) ? Number(noiseStr) : DEFAULT_NOISE_DB;
  const minDurationS = durStr !== null && Number(durStr) > 0 ? Number(durStr) : DEFAULT_MIN_DURATION_S;

  let path: string;
  try {
    if (trackRef) {
      const refPath = trackRefPath(trackRef);
      if (!refPath) return NextResponse.json({ error: "Bad ref" }, { status: 400 });
      if (existsSync(refPath)) {
        path = refPath;
      } else if (cardId) {
        path = await ensureYotoTrackCached(trackRef, cardId, req.signal);
      } else {
        return NextResponse.json({ error: "Track not in local cache" }, { status: 404 });
      }
    } else if (audioUrl) {
      path = await ensureCached(audioUrl, req.signal);
    } else {
      return NextResponse.json({ error: "Missing url or ref param" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cache failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Check on-disk cache for analysis result first.
  const cachePath = silenceCachePathFor(path, noiseDb, minDurationS);
  if (existsSync(cachePath)) {
    try {
      const cached = JSON.parse(await readFile(cachePath, "utf8"));
      if (Array.isArray(cached?.silences)) return NextResponse.json(cached);
    } catch { /* fall through to re-analyze */ }
  }

  try {
    const t0 = Date.now();
    const silences = await detectSilences(path, noiseDb, minDurationS, req.signal);
    console.log(`[silence] ${path.split("/").pop()} (noise=${noiseDb}dB, dur=${minDurationS}s): ${silences.length} regions in ${Date.now() - t0}ms`);
    const result = { silences, threshold: { noiseDb, minDurationSec: minDurationS } };
    try {
      await mkdir(SILENCE_CACHE_DIR, { recursive: true });
      await writeFile(cachePath, JSON.stringify(result));
    } catch { /* non-fatal */ }
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 502;
    const message = err instanceof Error ? err.message : "Silence detection failed";
    return NextResponse.json({ error: message }, { status });
  }
}

// Force unused import warning suppression for `stat` (kept in case we want size-aware skips later).
void stat;
