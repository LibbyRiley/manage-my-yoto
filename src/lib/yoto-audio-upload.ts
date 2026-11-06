import crypto from "crypto";

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 240_000; // 4 minutes for transcoding to complete

export interface TranscodeInfo {
  duration?: number;
  fileSize?: number;
  channels?: string;
  format?: string;
}

export type ProgressEvent =
  | { stage: "fetching" | "trimming" | "uploading" | "transcoding"; message: string; progress: number }
  | { stage: "done"; trackUrl: string; progress: 100; duration?: number; transcode?: TranscodeInfo }
  | { stage: "failed"; error: string };

export type ProgressCallback = (event: ProgressEvent) => void;

export interface UploadResult {
  trackUrl: string;
  transcode: TranscodeInfo;
}

function extractTranscodeInfo(transcode: Record<string, unknown>, data: Record<string, unknown>): TranscodeInfo {
  // Yoto's transcoder converts uploads to opus/ogg and reports the *actual*
  // stored file's metadata under `transcode.transcodedInfo`. The hardware device
  // decodes by these values, so reporting source-file metadata (e.g. mp3/aac
  // format, pre-transcode fileSize) makes it fail to play.
  const info = (transcode.transcodedInfo ?? transcode.info ?? data.transcodedInfo ?? data.info ?? transcode) as Record<string, unknown>;
  const duration = info.duration ?? transcode.duration ?? data.duration;
  const fileSize = info.fileSize ?? transcode.fileSize ?? data.fileSize ?? info.size ?? transcode.size;
  const channels = info.channels ?? transcode.channels ?? data.channels;
  const format = info.format ?? info.codec ?? transcode.format ?? data.format;
  return {
    duration: typeof duration === "number" && duration > 0 ? duration : undefined,
    fileSize: typeof fileSize === "number" && fileSize > 0 ? fileSize : undefined,
    channels: typeof channels === "string" ? channels : undefined,
    format: typeof format === "string" ? format : undefined,
  };
}

export async function uploadAudioToYoto(token: string, buffer: Buffer, filename: string, onProgress?: ProgressCallback): Promise<UploadResult> {
  const sizeMb = (buffer.length / 1024 / 1024).toFixed(1);
  console.log(`[yoto-upload] ${filename}: hashing ${sizeMb} MB…`);
  onProgress?.({ stage: "uploading", message: "Preparing upload", progress: 40 });
  const t0 = Date.now();
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  console.log(`[yoto-upload] ${filename}: sha256=${sha256.slice(0, 12)}… (${Date.now() - t0}ms)`);

  // Step 1: get a signed S3 upload URL
  console.log(`[yoto-upload] ${filename}: requesting upload URL from Yoto…`);
  const t1 = Date.now();
  const uploadUrlRes = await fetch(
    `https://api.yotoplay.com/media/transcode/audio/uploadUrl?${new URLSearchParams({ sha256, filename })}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!uploadUrlRes.ok) {
    const body = await uploadUrlRes.text();
    console.error(`[yoto-upload] ${filename}: uploadUrl request failed ${uploadUrlRes.status} — ${body}`);
    throw new Error(`Failed to get upload URL: ${uploadUrlRes.status} — ${body}`);
  }
  const { upload: { uploadId, uploadUrl } } = await uploadUrlRes.json() as {
    upload: { uploadId: string; uploadUrl: string | null };
  };
  console.log(`[yoto-upload] ${filename}: got uploadId=${uploadId}, uploadUrl=${uploadUrl ? "present" : "null (already in store)"} (${Date.now() - t1}ms)`);

  // Step 2: PUT to S3 only if file isn't already in Yoto's store
  if (uploadUrl) {
    onProgress?.({ stage: "uploading", message: `Uploading ${sizeMb} MB to Yoto`, progress: 50 });
    console.log(`[yoto-upload] ${filename}: uploading ${sizeMb} MB to S3…`);
    const t2 = Date.now();
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "audio/mpeg" },
      body: new Uint8Array(buffer),
    });
    if (!putRes.ok) {
      const body = await putRes.text().catch(() => "");
      console.error(`[yoto-upload] ${filename}: S3 PUT failed ${putRes.status} — ${body.slice(0, 200)}`);
      throw new Error(`S3 upload failed: ${putRes.status}`);
    }
    console.log(`[yoto-upload] ${filename}: S3 PUT done (${Date.now() - t2}ms)`);
    onProgress?.({ stage: "uploading", message: "Upload complete", progress: 75 });
  } else {
    onProgress?.({ stage: "uploading", message: "Already in Yoto's store", progress: 75 });
  }

  // Step 3: poll for transcodedSha256 — required for the yoto:# reference
  console.log(`[yoto-upload] ${filename}: polling for transcoded result (timeout ${POLL_TIMEOUT_MS / 1000}s)…`);
  onProgress?.({ stage: "transcoding", message: "Yoto is processing the audio", progress: 80 });
  const pollStart = Date.now();
  let pollCount = 0;
  // If file was already in store, transcoding may already be done — check immediately first.
  if (!uploadUrl) {
    const res = await fetch(
      `https://api.yotoplay.com/media/upload/${uploadId}/transcoded?loudnorm=false`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      const transcode = (data.transcode ?? data) as Record<string, unknown>;
      const transcodedSha256 = (transcode.transcodedSha256 ?? data.transcodedSha256) as string | undefined;
      if (transcodedSha256) {
        console.log(`[yoto-upload] ${filename}: raw transcoded response:`, JSON.stringify(data, null, 2));
        const info = extractTranscodeInfo(transcode, data);
        console.log(`[yoto-upload] ${filename}: dedupe hit — ready immediately${info.duration ? ` (${info.duration}s, ${info.fileSize ?? "?"}B, ${info.channels ?? "?"}ch)` : ""}`);
        return { trackUrl: `yoto:#${transcodedSha256}`, transcode: info };
      }
    }
  }

  while (Date.now() - pollStart < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    pollCount++;
    // Slowly creep progress toward 99 while polling so the bar shows liveness.
    const elapsedFrac = Math.min(0.95, (Date.now() - pollStart) / POLL_TIMEOUT_MS);
    onProgress?.({
      stage: "transcoding",
      message: `Yoto is processing (${Math.round((Date.now() - pollStart) / 1000)}s)`,
      progress: 80 + Math.round(elapsedFrac * 19),
    });
    const res = await fetch(
      `https://api.yotoplay.com/media/upload/${uploadId}/transcoded?loudnorm=false`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      const transcode = (data.transcode ?? data) as Record<string, unknown>;
      const transcodedSha256 = (transcode.transcodedSha256 ?? data.transcodedSha256) as string | undefined;
      if (transcodedSha256) {
        console.log(`[yoto-upload] ${filename}: raw transcoded response:`, JSON.stringify(data, null, 2));
        const info = extractTranscodeInfo(transcode, data);
        console.log(`[yoto-upload] ${filename}: transcoded after ${pollCount} polls (${((Date.now() - pollStart) / 1000).toFixed(1)}s)${info.duration ? ` — ${info.duration}s, ${info.fileSize ?? "?"}B, ${info.channels ?? "?"}ch` : ""}`);
        return { trackUrl: `yoto:#${transcodedSha256}`, transcode: info };
      }
    } else if (pollCount % 10 === 0) {
      console.log(`[yoto-upload] ${filename}: poll #${pollCount} returned ${res.status}`);
    }
  }

  console.error(`[yoto-upload] ${filename}: transcoding timed out after ${pollCount} polls`);
  throw new Error(uploadUrl ? "Transcoding timed out" : "File exists in store but transcoding not found — it may be from a failed previous upload");
}
