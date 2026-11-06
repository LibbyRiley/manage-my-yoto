import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { readFile, unlink, mkdir, copyFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { getYotoToken } from "@/lib/yoto-session";
import { uploadAudioToYoto, type ProgressEvent } from "@/lib/yoto-audio-upload";
import { ensureCached, saveTrackRefCache, ensureYotoTrackCached } from "@/lib/audio-cache";
import { probeAudio } from "@/lib/ffprobe";

export const runtime = "nodejs";
export const maxDuration = 600;

const MAX_BYTES = 200 * 1024 * 1024;
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

function trimAudio(inPath: string, outPath: string, trimStart?: number, trimEnd?: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const startSec = typeof trimStart === "number" && trimStart > 0 ? trimStart : 0;
    const endSec = typeof trimEnd === "number" && trimEnd > 0 ? trimEnd : undefined;

    // Re-encode rather than -c copy. Stream-copy seeking on VBR MP3 files (most podcast
    // feeds) is byte-offset-estimated from the average bitrate and can land far off the
    // requested time — this is what was producing "right duration, wrong start point".
    // libmp3lame at 128 kbps is plenty for spoken podcast audio and gives sample-accurate
    // cuts. Adds ~5-30 s of CPU time for a typical episode.
    const args: string[] = ["-y", "-i", inPath];
    if (startSec > 0) args.push("-ss", String(startSec));
    if (endSec !== undefined) args.push("-to", String(endSec));
    args.push("-c:a", "libmp3lame", "-b:a", "128k", "-f", "mp3", outPath);

    console.log(`[ffmpeg] ${FFMPEG} ${args.join(" ")}`);
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

const DEBUG_DIR = join(process.cwd(), "downloads");
const DEBUG_SOURCE_PATH = join(DEBUG_DIR, "debug-last-source.mp3");
const DEBUG_TRIM_PATH = join(DEBUG_DIR, "debug-last-trim.mp3");
async function saveDebugCopy(srcPath: string, destPath: string, label: string) {
  try {
    await mkdir(DEBUG_DIR, { recursive: true });
    await copyFile(srcPath, destPath);
    console.log(`[upload-audio] ${label} copy saved to ${destPath}`);
  } catch (err) {
    console.warn(`[upload-audio] failed to save ${label} copy:`, err);
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  const token = getYotoToken();
  if (!token) {
    return jsonResponse({ error: "Not authenticated with Yoto" }, 401);
  }

  let audioUrl: string;
  let filename: string;
  let trimStart: number | undefined;
  let trimEnd: number | undefined;
  try {
    const body = await req.json();
    audioUrl = String(body.audioUrl ?? "");
    filename = String(body.filename ?? "episode.mp3");
    trimStart = typeof body.trimStart === "number" && body.trimStart > 0 ? body.trimStart : undefined;
    trimEnd = typeof body.trimEnd === "number" && body.trimEnd > 0 ? body.trimEnd : undefined;
    if (!audioUrl) throw new Error("audioUrl required");
    if (trimStart !== undefined && trimEnd !== undefined && trimStart >= trimEnd) {
      throw new Error("trimStart must be less than trimEnd");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request body";
    return jsonResponse({ error: message }, 400);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(event: ProgressEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      let outPath: string | null = null;
      try {
        emit({ stage: "fetching", message: "Loading audio", progress: 5 });
        console.log(`[upload-audio] ${filename}: ensuring cached for ${audioUrl}${trimStart !== undefined || trimEnd !== undefined ? ` (trim ${trimStart ?? 0} → ${trimEnd ?? "end"})` : ""}`);
        const fetchStart = Date.now();
        // Re-trimming an already-uploaded track: the editor passes the audio
        // proxy URL (relative path) which the server can't fetch directly.
        // Detect it, pull the yoto:# ref + cardId from query params, and use
        // the dedicated cache helper instead.
        let cachedPath: string;
        if (audioUrl.startsWith("/api/podcasts/audio")) {
          const params = new URLSearchParams(audioUrl.split("?")[1] ?? "");
          const ref = params.get("ref");
          const cardId = params.get("cardId");
          if (!ref?.startsWith("yoto:#") || !cardId) {
            throw new Error("Invalid yoto track proxy URL (missing ref or cardId)");
          }
          cachedPath = await ensureYotoTrackCached(ref, cardId, req.signal);
        } else {
          cachedPath = await ensureCached(audioUrl, req.signal);
        }
        let buffer = await readFile(cachedPath);
        if (buffer.length > MAX_BYTES) {
          throw Object.assign(new Error("Episode too large to upload — will stream instead"), { status: 413 });
        }
        const sizeMb = (buffer.length / 1024 / 1024).toFixed(1);
        console.log(`[upload-audio] ${filename}: loaded ${sizeMb}MB in ${Date.now() - fetchStart}ms`);
        emit({ stage: "fetching", message: `Loaded ${sizeMb} MB`, progress: 25 });

        const needsTrim = trimStart !== undefined || trimEnd !== undefined;
        if (needsTrim) {
          emit({ stage: "trimming", message: "Trimming audio", progress: 30 });
          const id = randomUUID();
          outPath = join(tmpdir(), `podcast-trim-${id}-out.mp3`);
          console.log(`[upload-audio] ${filename}: running ffmpeg trim on cached source…`);
          const ffStart = Date.now();
          await saveDebugCopy(cachedPath, DEBUG_SOURCE_PATH, "source");
          await trimAudio(cachedPath, outPath, trimStart, trimEnd, req.signal);
          buffer = await readFile(outPath);
          console.log(`[upload-audio] ${filename}: ffmpeg trim done (${Date.now() - ffStart}ms, ${(buffer.length / 1024 / 1024).toFixed(1)}MB output)`);
          await saveDebugCopy(outPath, DEBUG_TRIM_PATH, "trim");
          emit({ stage: "trimming", message: "Trim complete", progress: 38 });
        }

        const { trackUrl, transcode } = await uploadAudioToYoto(token, buffer, filename, emit);
        // Cache the exact bytes that were uploaded so the editor can play them back
        // locally (Yoto's CDN URL `yoto:#<sha>` can't be played by a browser audio tag).
        await saveTrackRefCache(trackUrl, buffer);
        // The hardware Yoto Player needs duration/fileSize/channels/format on uploaded
        // tracks. ffprobe the actual uploaded bytes — Yoto's transcode response shape
        // isn't documented, so this is more reliable than parsing it.
        const probed = await probeAudio(needsTrim && outPath ? outPath : cachedPath);
        // Prefer Yoto's reported transcoded values — the hardware device decodes
        // by them. Local ffprobe is only a fallback if Yoto didn't report something.
        const finalTranscode: typeof transcode = {
          duration: transcode.duration ?? probed.duration,
          fileSize: transcode.fileSize,
          channels: transcode.channels ?? probed.channels,
          format: transcode.format ?? probed.format,
        };
        console.log(`[upload-audio] ${filename}: SUCCESS → ${trackUrl}${finalTranscode.duration ? ` (${finalTranscode.duration.toFixed(1)}s, ${finalTranscode.channels ?? "?"}, ${finalTranscode.format ?? "?"})` : ""}`);
        emit({ stage: "done", trackUrl, progress: 100, duration: finalTranscode.duration, transcode: finalTranscode });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        console.error(`[upload-audio] ${filename}: FAILED — ${message}`);
        emit({ stage: "failed", error: message });
      } finally {
        // Source comes from the persistent audio cache — don't unlink it.
        if (outPath) await unlink(outPath).catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
