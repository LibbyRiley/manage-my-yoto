import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { readFile, unlink, mkdir, copyFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { ensureCached } from "@/lib/audio-cache";

const DEBUG_DIR = join(process.cwd(), "downloads");
const DEBUG_SOURCE_PATH = join(DEBUG_DIR, "debug-last-source.mp3");
const DEBUG_TRIM_PATH = join(DEBUG_DIR, "debug-last-trim.mp3");
async function saveDebugCopy(srcPath: string, destPath: string, label: string) {
  try {
    await mkdir(DEBUG_DIR, { recursive: true });
    await copyFile(srcPath, destPath);
    console.log(`[trim-only] ${label} copy saved to ${destPath}`);
  } catch (err) {
    console.warn(`[trim-only] failed to save ${label} copy:`, err);
  }
}

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 200 * 1024 * 1024;
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

function trimAudio(inPath: string, outPath: string, trimStart?: number, trimEnd?: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const startSec = typeof trimStart === "number" && trimStart > 0 ? trimStart : 0;
    const endSec = typeof trimEnd === "number" && trimEnd > 0 ? trimEnd : undefined;

    const args: string[] = ["-y", "-i", inPath];
    if (startSec > 0) args.push("-ss", String(startSec));
    if (endSec !== undefined) args.push("-to", String(endSec));
    args.push("-c:a", "libmp3lame", "-b:a", "128k", "-f", "mp3", outPath);

    console.log(`[trim-only/ffmpeg] ${FFMPEG} ${args.join(" ")}`);
    const proc = spawn(FFMPEG, args);
    const stderr: string[] = [];
    proc.stderr.on("data", (d: Buffer) => stderr.push(d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-3).join("").trim() || `ffmpeg exited with code ${code}`));
    });
    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") reject(Object.assign(new Error("ffmpeg not installed — run `brew install ffmpeg`"), { status: 503 }));
      else reject(new Error(`ffmpeg failed: ${err.message}`));
    });
    signal?.addEventListener("abort", () => { proc.kill(); reject(new Error("Aborted")); });
  });
}

export async function POST(req: NextRequest) {
  let audioUrl: string;
  let filename: string;
  let trimStart: number | undefined;
  let trimEnd: number | undefined;
  try {
    const body = await req.json();
    audioUrl = String(body.audioUrl ?? "");
    filename = String(body.filename ?? "trimmed.mp3");
    trimStart = typeof body.trimStart === "number" && body.trimStart > 0 ? body.trimStart : undefined;
    trimEnd = typeof body.trimEnd === "number" && body.trimEnd > 0 ? body.trimEnd : undefined;
    if (!audioUrl) throw new Error("audioUrl required");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.log(`[trim-only] ${filename}: ensuring cached for ${audioUrl} (trim ${trimStart ?? 0} → ${trimEnd ?? "end"})`);
  let inPath: string;
  try {
    inPath = await ensureCached(audioUrl, req.signal);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  const sourceBuf = await readFile(inPath);
  if (sourceBuf.length > MAX_BYTES) {
    return NextResponse.json({ error: "Episode too large" }, { status: 413 });
  }

  const id = randomUUID();
  const outPath = join(tmpdir(), `trim-only-${id}-out.mp3`);
  try {
    await saveDebugCopy(inPath, DEBUG_SOURCE_PATH, "source");
    await trimAudio(inPath, outPath, trimStart, trimEnd, req.signal);
    const buffer = await readFile(outPath);
    console.log(`[trim-only] ${filename}: ${(buffer.length / 1024 / 1024).toFixed(1)} MB output`);
    await saveDebugCopy(outPath, DEBUG_TRIM_PATH, "trim");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trim failed";
    console.error(`[trim-only] ${filename}: FAILED — ${message}`);
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    // inPath is the persistent cache file — don't unlink it.
    await unlink(outPath).catch(() => {});
  }
}
