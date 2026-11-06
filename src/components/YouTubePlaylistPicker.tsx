"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/lib/store";

function parseClockDuration(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    return n > 0 ? n : undefined;
  }
  const parts = trimmed.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return undefined;
  let total = 0;
  if (parts.length === 3) total = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) total = parts[0] * 60 + parts[1];
  else return undefined;
  return total > 0 ? total : undefined;
}

interface VideoItem {
  id: string;
  title: string;
  duration: string;
  thumbnail: string | null;
  selected: boolean;
  status: "pending" | "processing" | "done" | "error";
}

export function YouTubePlaylistPicker() {
  const { appendPlaylistTracks, setStep, setPodcast } = useAppStore();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playlistTitle, setPlaylistTitle] = useState("");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchPlaylist(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setVideos([]);
    try {
      const res = await fetch(`/api/youtube/playlist?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlaylistTitle(data.title);
      setPodcast({ id: "youtube", title: data.title, author: data.author ?? "", description: "", artworkUrl: "", feedUrl: url.trim(), episodeCount: data.videos.length });
      setVideos(data.videos.map((v: Omit<VideoItem, "selected" | "status">) => ({ ...v, selected: false, status: "pending" as const })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch playlist");
    } finally {
      setLoading(false);
    }
  }

  function toggleAll(checked: boolean) {
    setVideos((prev) => prev.map((v) => ({ ...v, selected: checked })));
  }

  function stopProcessing() {
    cancelledRef.current = true;
    abortRef.current?.abort();
  }

  async function processVideos() {
    const selected = videos.filter((v) => v.selected);
    if (selected.length === 0) return;
    cancelledRef.current = false;
    setProcessing(true);

    const results: { id: string; title: string; trackUrl: string; duration?: number; fileSize?: number; channels?: string; format?: string }[] = [];

    for (const video of selected) {
      if (cancelledRef.current) break;
      setVideos((prev) => prev.map((v) => v.id === video.id ? { ...v, status: "processing" } : v));
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        // Step 1: download via yt-dlp on the server
        const downloadRes = await fetch("/api/youtube/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: video.id }),
          signal: controller.signal,
        });
        const downloadData = await downloadRes.json() as { localUrl?: string; error?: string };
        if (!downloadRes.ok) throw new Error(downloadData.error ?? "Download failed");

        // Step 2: fetch the blob from the local serve endpoint
        const blobRes = await fetch(downloadData.localUrl!, { signal: controller.signal });
        if (!blobRes.ok) throw new Error("Failed to fetch downloaded audio");
        const blob = await blobRes.blob();

        // Step 3: upload to Yoto via FormData — identical to custom tracks
        const formData = new FormData();
        formData.append("file", blob, `yt-${video.id}.mp3`);
        const uploadRes = await fetch("/api/audio/upload", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        const uploadData = await uploadRes.json() as { trackUrl?: string; duration?: number; fileSize?: number; channels?: string; format?: string; error?: string };
        if (!uploadRes.ok || !uploadData.trackUrl) throw new Error(uploadData.error ?? "Upload failed");

        setVideos((prev) => prev.map((v) => v.id === video.id ? { ...v, status: "done" } : v));
        results.push({
          id: video.id,
          title: video.title,
          trackUrl: uploadData.trackUrl!,
          duration: uploadData.duration ?? parseClockDuration(video.duration),
          fileSize: uploadData.fileSize,
          channels: uploadData.channels,
          format: uploadData.format,
        });
      } catch (err) {
        const status = cancelledRef.current ? "pending" : "error";
        setVideos((prev) => prev.map((v) => v.id === video.id ? { ...v, status } : v));
        if (cancelledRef.current) break;
      }
    }

    if (results.length > 0) {
      appendPlaylistTracks(
        results.map((r, i) => ({
          key: String(i + 1).padStart(2, "0"),
          title: r.title,
          trackUrl: r.trackUrl,
          iconRef: "",
          episodeGuid: `yt-${r.id}`,
          duration: r.duration,
          ...(r.fileSize !== undefined ? { fileSize: r.fileSize } : {}),
          ...(r.channels ? { channels: r.channels } : {}),
          ...(r.format ? { format: r.format } : {}),
        }))
      );
      if (!cancelledRef.current) setStep("editor");
    }
    setProcessing(false);
  }

  const selectedCount = videos.filter((v) => v.selected).length;
  const doneCount = videos.filter((v) => v.status === "done").length;
  const errorCount = videos.filter((v) => v.status === "error").length;

  return (
    <div className="space-y-4">
      <form onSubmit={fetchPlaylist} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/playlist?list=..."
          className="flex-1 px-3 py-2 text-sm bg-[var(--card)] border border-[var(--border)] rounded-lg focus:border-[var(--accent)] focus:outline-none transition-colors"
          disabled={loading || processing}
        />
        <button
          type="submit"
          disabled={!url.trim() || loading || processing}
          className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
          ) : "Fetch"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {videos.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{playlistTitle}</p>
              <p className="text-xs text-[var(--muted)]">{selectedCount} of {videos.length} selected</p>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={videos.every((v) => v.selected)}
                onChange={(e) => toggleAll(e.target.checked)}
                disabled={processing}
                className="accent-[var(--accent)]"
              />
              Select all
            </label>
          </div>

          <div className="space-y-1 max-h-72 overflow-y-auto">
            {videos.map((video) => (
              <label
                key={video.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                  video.selected ? "border-[var(--accent)]/30 bg-[var(--card)]" : "border-[var(--border)] bg-transparent opacity-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={video.selected}
                  onChange={(e) => setVideos((prev) => prev.map((v) => v.id === video.id ? { ...v, selected: e.target.checked } : v))}
                  disabled={processing}
                  className="accent-[var(--accent)] shrink-0"
                />
                {video.thumbnail && (
                  <img src={video.thumbnail} alt="" className="w-10 h-7 object-cover rounded shrink-0" />
                )}
                <span className="flex-1 min-w-0 text-sm truncate">{video.title}</span>
                <span className="text-xs text-[var(--muted)] shrink-0">{video.duration}</span>
                <span className="shrink-0 w-4 text-center">
                  {video.status === "processing" && (
                    <span className="w-3.5 h-3.5 border-2 border-[var(--accent)]/40 border-t-[var(--accent)] rounded-full animate-spin inline-block" />
                  )}
                  {video.status === "done" && <span className="text-green-400 text-xs">✓</span>}
                  {video.status === "error" && <span className="text-red-400 text-xs">✕</span>}
                </span>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3">
            {processing && (
              <p className="text-xs text-[var(--muted)] mr-auto">
                Processing {doneCount + errorCount} of {selectedCount}…{errorCount > 0 ? ` (${errorCount} failed)` : ""}
              </p>
            )}
            {processing && (
              <button
                onClick={stopProcessing}
                className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-red-400 hover:border-red-400/50 rounded-lg transition-colors"
              >
                Stop
              </button>
            )}
            <button
              onClick={processVideos}
              disabled={selectedCount === 0 || processing}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {processing && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {processing ? "Processing…" : `Add ${selectedCount} track${selectedCount !== 1 ? "s" : ""} →`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
