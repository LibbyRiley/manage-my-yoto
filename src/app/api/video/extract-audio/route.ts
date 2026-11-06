import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { getYotoToken } from "@/lib/yoto-session";
import { uploadAudioToYoto } from "@/lib/yoto-audio-upload";
import { saveTrackRefCache, trackRefPath } from "@/lib/audio-cache";
import { probeAudio } from "@/lib/ffprobe";

export const runtime = "nodejs";
export const maxDuration = 300;

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

function extractAudio(inPath: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // -vn: drop video stream. libmp3lame 128k matches the rest of the app.
    const args = ["-y", "-i", inPath, "-vn", "-acodec", "libmp3lame", "-b:a", "128k", "-f", "mp3", outPath];
    const proc = spawn(FFMPEG, args);
    const stderr: string[] = [];
    proc.stderr.on("data", (d: Buffer) => stderr.push(d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-3).join("").trim() || `ffmpeg exited with code ${code}`));
    });
    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") reject(new Error("ffmpeg not installed — run `brew install ffmpeg`"));
      else reject(new Error(`ffmpeg failed: ${err.message}`));
    });
  });
}

export async function POST(req: NextRequest) {
  const token = getYotoToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated with Yoto" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const id = randomUUID();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
  const inPath = join(tmpdir(), `video-in-${id}.${ext}`);
  const outPath = join(tmpdir(), `video-out-${id}.mp3`);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inPath, buffer);

    await extractAudio(inPath, outPath);

    const audioBuffer = await readFile(outPath);
    const audioFilename = file.name.replace(/\.[^.]+$/, ".mp3");
    const { trackUrl, transcode } = await uploadAudioToYoto(token, audioBuffer, audioFilename);
    await saveTrackRefCache(trackUrl, audioBuffer);
    const cachedPath = trackRefPath(trackUrl);
    const probed = cachedPath ? await probeAudio(cachedPath) : {};

    return NextResponse.json({
      trackUrl,
      duration: transcode.duration ?? probed.duration,
      fileSize: transcode.fileSize,
      channels: transcode.channels ?? probed.channels,
      format: transcode.format ?? probed.format,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}
