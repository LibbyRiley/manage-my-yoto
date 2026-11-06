import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { mkdir } from "fs/promises";
import { join } from "path";
import { getYotoToken } from "@/lib/yoto-session";

export const maxDuration = 300;

const YTDLP = process.env.YTDLP_PATH ?? "/opt/homebrew/bin/yt-dlp";
const DOWNLOADS_DIR = join(process.cwd(), "downloads");

function downloadAudio(videoId: string, outPath: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, [
      "--no-playlist",
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", "5",
      "-o", outPath,
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);

    const stderr: string[] = [];
    proc.stderr.on("data", (d: Buffer) => stderr.push(d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-3).join("").trim() || `yt-dlp exited with code ${code}`));
    });
    proc.on("error", (err) => reject(new Error(`yt-dlp not found: ${err.message}`)));
    signal?.addEventListener("abort", () => { proc.kill(); reject(new Error("Aborted")); });
  });
}

export async function POST(req: NextRequest) {
  const token = getYotoToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { videoId } = await req.json() as { videoId: string };
  if (!videoId) return NextResponse.json({ error: "videoId required" }, { status: 400 });

  await mkdir(DOWNLOADS_DIR, { recursive: true });
  const outPath = join(DOWNLOADS_DIR, `yt-${videoId}.mp3`);

  try {
    await downloadAudio(videoId, outPath, req.signal);
    console.log(`[youtube/audio] ${videoId} downloaded → serving locally for browser upload`);
    return NextResponse.json({ localUrl: `/api/audio/serve/yt-${videoId}.mp3` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[youtube/audio] ${videoId} download failed:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
