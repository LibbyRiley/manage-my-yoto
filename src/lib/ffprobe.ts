import { spawn } from "child_process";

const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";

export interface ProbedAudio {
  duration?: number;
  channels?: string;
  format?: string;
}

export function probeAudio(filePath: string): Promise<ProbedAudio> {
  return new Promise((resolve) => {
    const proc = spawn(FFPROBE, [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=channels,codec_name:format=duration",
      "-of", "json",
      filePath,
    ]);
    let stdout = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.on("close", (code) => {
      if (code !== 0) return resolve({});
      try {
        const parsed = JSON.parse(stdout) as { streams?: Array<{ channels?: number; codec_name?: string }>; format?: { duration?: string } };
        const stream = parsed.streams?.[0];
        const dur = parsed.format?.duration ? parseFloat(parsed.format.duration) : NaN;
        const ch = stream?.channels;
        resolve({
          duration: Number.isFinite(dur) && dur > 0 ? dur : undefined,
          channels: ch === 1 ? "mono" : ch === 2 ? "stereo" : undefined,
          format: stream?.codec_name,
        });
      } catch {
        resolve({});
      }
    });
    proc.on("error", () => resolve({}));
  });
}
