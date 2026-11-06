import { NextRequest, NextResponse } from "next/server";
import { getYotoToken } from "@/lib/yoto-session";
import { uploadAudioToYoto } from "@/lib/yoto-audio-upload";
import { saveTrackRefCache, trackRefPath } from "@/lib/audio-cache";
import { probeAudio } from "@/lib/ffprobe";

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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { trackUrl, transcode } = await uploadAudioToYoto(token, buffer, file.name);
    // Cache the just-uploaded bytes locally so the editor's play button works
    // before the playlist has been saved (no cardId for the Yoto resolve fallback yet).
    await saveTrackRefCache(trackUrl, buffer);
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
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
