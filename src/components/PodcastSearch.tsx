"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Podcast } from "@/types";

interface CustomTrack {
  title: string;
  url: string;
  uploading?: boolean;
  uploadError?: string;
}

export function PodcastSearch() {
  const { setPodcast, setStep, setEpisodes, setPlaylistTracks, selectedCard } = useAppStore();
  const [mode, setMode] = useState<"rss" | "custom">("rss");

  // RSS mode
  const [rssUrl, setRssUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Custom tracks mode
  const [customTracks, setCustomTracks] = useState<CustomTrack[]>([]);
  const [trackTitle, setTrackTitle] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [inputMode, setInputMode] = useState<"url" | "file">("url");

  async function handleRssSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rssUrl.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/podcasts/episodes?feedUrl=${encodeURIComponent(rssUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPodcast({
        id: "rss-direct",
        title: data.title || "Custom Feed",
        author: data.author || "",
        description: "",
        artworkUrl: data.artworkUrl || "",
        feedUrl: rssUrl,
        episodeCount: data.episodes.length,
      });
      setEpisodes(data.episodes);
      setStep("episodes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse feed");
    } finally {
      setLoading(false);
    }
  }

  function handleAddTrack(e: React.FormEvent) {
    e.preventDefault();
    if (!trackTitle.trim() || !trackUrl.trim()) return;
    setCustomTracks((prev) => [...prev, { title: trackTitle.trim(), url: trackUrl.trim() }]);
    setTrackTitle("");
    setTrackUrl("");
  }

  async function handleFileAdd(file: File) {
    if (!trackTitle.trim()) return;
    const title = trackTitle.trim();
    const placeholder: CustomTrack = { title, url: "", uploading: true };
    setCustomTracks((prev) => [...prev, placeholder]);
    setTrackTitle("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/audio/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setCustomTracks((prev) =>
        prev.map((t) => t === placeholder ? { title, url: data.trackUrl, uploading: false } : t)
      );
    } catch (err) {
      setCustomTracks((prev) =>
        prev.map((t) => t === placeholder ? { title, url: "", uploading: false, uploadError: err instanceof Error ? err.message : "Upload failed" } : t)
      );
    }
  }

  function handleRemoveTrack(index: number) {
    setCustomTracks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCustomContinue() {
    if (customTracks.length === 0) return;
    setPlaylistTracks(
      customTracks.map((t, i) => ({
        key: String(i + 1).padStart(2, "0"),
        title: t.title,
        trackUrl: t.url,
        iconRef: "",
        iconPreviewUrl: undefined,
        episodeGuid: `custom-${i}`,
      }))
    );
    setStep("editor");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Add Tracks</h2>
          {selectedCard && (
            <p className="text-sm text-[var(--muted)]">
              Adding to: <span className="text-[var(--accent-light)]">{selectedCard.title}</span>
            </p>
          )}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-[var(--card)] border border-[var(--border)] rounded-lg w-fit">
        <button
          onClick={() => setMode("rss")}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
            mode === "rss" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          RSS Feed
        </button>
        <button
          onClick={() => setMode("custom")}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
            mode === "custom" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          Custom Tracks
        </button>
      </div>

      {/* RSS mode */}
      {mode === "rss" && (
        <>
          <form onSubmit={handleRssSubmit} className="flex gap-3">
            <input
              type="url"
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="flex-1 px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !rssUrl.trim()}
              className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
            >
              {loading ? "Loading..." : "Load Feed"}
            </button>
          </form>
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
        </>
      )}

      {/* Custom tracks mode */}
      {mode === "custom" && (
        <>
          <div className="space-y-2">
            <input
              type="text"
              value={trackTitle}
              onChange={(e) => setTrackTitle(e.target.value)}
              placeholder="Track title"
              className="w-full px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              autoFocus
            />
            <div className="flex gap-1 p-1 bg-[var(--card)] border border-[var(--border)] rounded-lg w-fit text-xs">
              {(["url", "file"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setInputMode(m)}
                  className={`px-3 py-1 rounded-md transition-colors ${inputMode === m ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                >
                  {m === "url" ? "URL" : "Upload file"}
                </button>
              ))}
            </div>
            {inputMode === "url" ? (
              <form onSubmit={handleAddTrack} className="flex gap-3">
                <input
                  type="url"
                  value={trackUrl}
                  onChange={(e) => setTrackUrl(e.target.value)}
                  placeholder="https://example.com/audio.mp3"
                  className="flex-1 px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
                <button
                  type="submit"
                  disabled={!trackTitle.trim() || !trackUrl.trim()}
                  className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors shrink-0"
                >
                  Add
                </button>
              </form>
            ) : (
              <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${trackTitle.trim() ? "border-[var(--accent)]/50 hover:border-[var(--accent-light)] hover:bg-[var(--card)]" : "border-[var(--border)] opacity-50 cursor-not-allowed"}`}>
                <span className="text-sm text-[var(--muted)]">{trackTitle.trim() ? "Choose audio file…" : "Enter a title first"}</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  disabled={!trackTitle.trim()}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileAdd(f); e.target.value = ""; }}
                />
              </label>
            )}
          </div>

          {customTracks.length > 0 && (
            <div className="space-y-1">
              {customTracks.map((track, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg"
                >
                  <span className="text-xs text-[var(--muted)] font-mono w-5 shrink-0 text-right">{i + 1}</span>
                  {track.uploading ? (
                    <div className="w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : track.uploadError ? (
                    <span className="text-red-400 text-xs shrink-0">✕</span>
                  ) : (
                    <span className="text-green-400 text-xs shrink-0">✓</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{track.title}</p>
                    {track.uploading && <p className="text-xs text-[var(--muted)]">Uploading to Yoto…</p>}
                    {track.uploadError && <p className="text-xs text-red-400 truncate">{track.uploadError}</p>}
                    {!track.uploading && !track.uploadError && <p className="text-xs text-[var(--muted)] truncate">{track.url}</p>}
                  </div>
                  <button
                    onClick={() => handleRemoveTrack(i)}
                    className="shrink-0 text-[var(--muted)] hover:text-red-400 transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-[var(--border)]">
            <button
              onClick={handleCustomContinue}
              disabled={customTracks.length === 0 || customTracks.some((t) => t.uploading || !t.url)}
              className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
            >
              Continue to Editor →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
