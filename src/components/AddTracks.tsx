"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { detectPodcastUrl } from "@/lib/url-resolvers";

const RESOLVED_FEED_CACHE_KEY = "resolvedFeedUrl:v1";

function readResolvedCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(RESOLVED_FEED_CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeResolvedCache(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RESOLVED_FEED_CACHE_KEY, JSON.stringify(map));
  } catch {
    // localStorage might be full or disabled — ignore.
  }
}
import { RadioStationPicker } from "@/components/RadioStationPicker";
import { YouTubePlaylistPicker } from "@/components/YouTubePlaylistPicker";
import { FEATURED_PODCASTS } from "@/lib/featured-podcasts";
import type { Podcast } from "@/types";

interface CustomTrack {
  title: string;
  url: string;
  uploading?: boolean;
  uploadError?: string;
  duration?: number;
  fileSize?: number;
  channels?: string;
  format?: string;
}

export function AddTracks() {
  const { setPodcast, setStep, setEpisodes, setPlaylistTracks, appendPlaylistTracks, playlistTracks, setSelectedCard, setEditingCardId, selectedCard } = useAppStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"rss" | "custom" | "radio" | "youtube" | null>(null);
  const initialSourceApplied = useRef(false);

  // Pre-select source from URL (?source=rss/custom/radio/youtube), e.g. when
  // entering the wizard from the homepage's Get Started cards. Apply once on
  // mount only — otherwise clicking the in-component "← Back" (which sets
  // mode=null) would immediately re-apply the source and trap the user.
  useEffect(() => {
    if (initialSourceApplied.current) return;
    initialSourceApplied.current = true;
    const src = searchParams?.get("source");
    if (src === "rss" || src === "custom" || src === "radio" || src === "youtube") {
      setMode(src);
    }
  }, [searchParams]);

  // Reset to the source picker AND drop ?source= from the URL so the picker
  // sticks (and so the browser back button has a clean state to return to).
  function backToPicker() {
    setMode(null);
    if (searchParams?.has("source")) {
      router.replace("/create");
    }
  }

  // Cards for matching featured podcasts
  interface LibCard { cardId: string; title: string; slug: string; coverImage: string | null; }
  const [libCards, setLibCards] = useState<LibCard[]>([]);
  useEffect(() => {
    if (mode !== "rss") return;
    fetch("/api/yoto/cards").then(r => r.json()).then(d => setLibCards(d.cards ?? [])).catch(() => {});
  }, [mode]);

  async function openLibCard(card: LibCard) {
    setSelectedCard({ cardId: card.cardId, title: card.title, slug: card.slug, coverImage: card.coverImage });
    setEditingCardId(card.cardId);
    try {
      const data = await fetch(`/api/yoto/cards/${card.cardId}`).then(r => r.json());
      setPlaylistTracks((data.chapters ?? []).map((ch: { key: string; title: string; iconRef?: string; iconPreviewUrl?: string; trackUrl?: string }, i: number) => ({
        key: String(i + 1).padStart(2, "0"),
        title: ch.title,
        trackUrl: ch.trackUrl ?? "",
        iconRef: ch.iconRef ?? "",
        iconPreviewUrl: ch.iconPreviewUrl ?? (ch.iconRef?.startsWith("http") ? ch.iconRef : undefined),
      })));
    } catch { setPlaylistTracks([]); }
    setStep("editor");
  }

  // RSS mode
  const [rssUrl, setRssUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Custom tracks mode
  const [customTracks, setCustomTracks] = useState<CustomTrack[]>([]);
  const [trackTitle, setTrackTitle] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [inputMode, setInputMode] = useState<"url" | "file">("file");

  function titleFromFilename(filename: string): string {
    return filename
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function handleRssSubmit(e: React.FormEvent, overrideUrl?: string) {
    e.preventDefault();
    const original = (overrideUrl ?? rssUrl).trim();
    if (!original) return;
    setLoading(true);
    setError("");
    try {
      // Apple/Spotify URL? Resolve to underlying RSS first. Cache resolved mappings.
      let feedUrl = original;
      if (detectPodcastUrl(original) !== "rss") {
        const cache = readResolvedCache();
        if (cache[original]) {
          feedUrl = cache[original];
        } else {
          const resolveRes = await fetch(`/api/podcasts/resolve?url=${encodeURIComponent(original)}`);
          const resolveData = await resolveRes.json();
          if (!resolveRes.ok || !resolveData.feedUrl) {
            throw new Error(resolveData.error || "Could not resolve podcast URL");
          }
          feedUrl = resolveData.feedUrl;
          writeResolvedCache({ ...cache, [original]: feedUrl });
        }
      }

      const res = await fetch(`/api/podcasts/episodes?feedUrl=${encodeURIComponent(feedUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPodcast({
        id: "rss-direct",
        title: data.title || "Custom Feed",
        author: data.author || "",
        description: data.description || "",
        artworkUrl: data.artworkUrl || "",
        feedUrl,
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

  async function uploadFile(file: File, placeholder: CustomTrack) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(file.name);
      const endpoint = isVideo ? "/api/video/extract-audio" : "/api/audio/upload";
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setCustomTracks((prev) =>
        prev.map((t) => t === placeholder ? {
          ...t,
          url: data.trackUrl,
          uploading: false,
          duration: data.duration,
          fileSize: data.fileSize,
          channels: data.channels,
          format: data.format,
        } : t)
      );
    } catch (err) {
      setCustomTracks((prev) =>
        prev.map((t) => t === placeholder ? { ...t, url: "", uploading: false, uploadError: err instanceof Error ? err.message : "Upload failed" } : t)
      );
    }
  }

  function handleFilesAdd(files: FileList) {
    const newTracks: CustomTrack[] = Array.from(files).map((file) => ({
      title: titleFromFilename(file.name),
      url: "",
      uploading: true,
    }));
    setCustomTracks((prev) => [...prev, ...newTracks]);
    newTracks.forEach((placeholder, i) => uploadFile(files[i], placeholder));
  }

  function handleRemoveTrack(index: number) {
    setCustomTracks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCustomContinue() {
    if (customTracks.length === 0) return;
    const startKey = selectedCard ? playlistTracks.length + 1 : 1;
    const mapped = customTracks.map((t, i) => ({
      key: String(startKey + i).padStart(2, "0"),
      title: t.title,
      trackUrl: t.url,
      iconRef: "",
      iconPreviewUrl: undefined,
      episodeGuid: `custom-${Date.now()}-${i}`,
      ...(t.duration !== undefined ? { duration: t.duration } : {}),
      ...(t.fileSize !== undefined ? { fileSize: t.fileSize } : {}),
      ...(t.channels ? { channels: t.channels } : {}),
      ...(t.format ? { format: t.format } : {}),
    }));
    if (selectedCard) appendPlaylistTracks(mapped);
    else setPlaylistTracks(mapped);
    setStep("editor");
  }

  // ── Source picker ──────────────────────────────────────────────
  if (mode === null) {
    const sources: {
      mode: "rss" | "custom" | "radio" | "youtube";
      title: string;
      description: string;
      gradient: string;
      image: string;
    }[] = [
      {
        mode: "rss",
        title: "Podcast / RSS",
        description: "Import episodes from any podcast feed URL",
        gradient: "linear-gradient(135deg, hsl(195 80% 18%) 0%, hsl(210 70% 10%) 100%)",
        image: "/images/source-rss.jpg",
      },
      {
        mode: "custom",
        title: "Custom Tracks",
        description: "Upload your own audio files or paste URLs",
        gradient: "linear-gradient(135deg, hsl(265 55% 20%) 0%, hsl(280 50% 10%) 100%)",
        image: "/images/source-custom.jpg",
      },
      {
        mode: "radio",
        title: "Radio Station",
        description: "Add live radio streams to your card",
        gradient: "linear-gradient(135deg, hsl(340 60% 20%) 0%, hsl(355 55% 10%) 100%)",
        image: "/images/source-radio.jpg",
      },
      {
        mode: "youtube",
        title: "YouTube Playlist",
        description: "Convert a YouTube playlist to audio tracks",
        gradient: "linear-gradient(135deg, hsl(15 70% 20%) 0%, hsl(30 65% 10%) 100%)",
        image: "/images/source-youtube.jpg",
      },
    ];

    return (
      <div className="space-y-8">
        <div>
          <h2 className="font-medium text-lg">{selectedCard ? "Add Tracks" : "New Playlist"}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {sources.map((source) => (
            <button
              key={source.mode}
              onClick={() => setMode(source.mode)}
              className="group flex flex-col bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent-light)] hover:-translate-y-1 hover:shadow-xl rounded-xl text-left transition-all duration-200 overflow-hidden"
            >
              {/* Hero image area */}
              <div className="relative w-full" style={{ aspectRatio: "3 / 2" }}>
                <div
                  className="absolute inset-0"
                  style={{ background: source.gradient }}
                />
                <img
                  src={source.image}
                  data-card={source.mode}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover group-hover:brightness-110 transition-all duration-200"
                />
              </div>
              {/* Text area */}
              <div className="flex flex-col gap-1 px-4 py-3 flex-1">
                <p className="font-semibold text-sm leading-snug">{source.title}</p>
                <p className="text-xs text-[var(--muted)] leading-relaxed">{source.description}</p>
                <span className="mt-auto pt-2 text-xs font-medium text-[var(--accent-light)] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  Choose →
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── RSS mode ───────────────────────────────────────────────────
  if (mode === "rss") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Podcast / RSS Feed</h2>
          <button onClick={backToPicker} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            ← Back
          </button>
        </div>

        <form onSubmit={(e) => handleRssSubmit(e)} className="flex gap-3">
          <input
            type="url"
            value={rssUrl}
            onChange={(e) => setRssUrl(e.target.value)}
            placeholder="RSS feed URL or Apple Podcasts link"
            className="flex-1 px-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !rssUrl.trim()}
            className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
          >
            {loading ? "Loading…" : "Load Feed"}
          </button>
        </form>
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-xs text-[var(--muted)]">or pick a featured podcast</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Featured podcasts */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Featured</p>
          <div className="grid grid-cols-5 gap-2">
            {FEATURED_PODCASTS.map((podcast) => {
              // In the editor "add tracks" flow we're already targeting a specific
              // card, so a name match against another playlist is irrelevant — let
              // the user pick the feed regardless.
              const match = selectedCard ? null : libCards.find(c => c.title.toLowerCase() === podcast.title.toLowerCase());
              return (
                <div key={podcast.id} className="flex flex-col gap-1.5">
                  <div className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-[var(--card)] border border-[var(--border)] group-hover:border-[var(--accent-light)] transition-colors">
                      <img src={podcast.artwork} alt={podcast.title} className="w-full h-full object-cover" />
                    </div>
                    {match ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openLibCard(match)}
                          className="absolute inset-0 rounded-lg flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Open playlist"
                        >
                          <span className="text-white text-base">✓</span>
                          <span className="text-white text-[10px] font-medium">Open playlist</span>
                        </button>
                        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[9px] font-bold pointer-events-none">✓</span>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={(e) => handleRssSubmit(e, podcast.feedUrl)}
                        className="absolute inset-0 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    )}
                  </div>
                  <p className="text-[11px] font-medium leading-snug line-clamp-2">{podcast.title}</p>
                  <p className="text-[10px] text-[var(--muted)] truncate">{podcast.publisher}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Radio mode ─────────────────────────────────────────────────
  if (mode === "radio") {
    return <RadioStationPicker onBack={backToPicker} />;
  }

  // ── YouTube mode ───────────────────────────────────────────────
  if (mode === "youtube") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">YouTube Playlist</h2>
          <button onClick={backToPicker} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            ← Back
          </button>
        </div>
        <YouTubePlaylistPicker />
      </div>
    );
  }

  // ── Custom tracks mode ─────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium text-lg">Custom Tracks</h2>
          <p className="text-sm text-[var(--muted)] mt-0.5">Add tracks, then continue to the playlist editor</p>
        </div>
        <button onClick={() => setMode(null)} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          ← Back
        </button>
      </div>

      {/* Add track form */}
      <div className="p-5 bg-[var(--card)] border border-[var(--border)] rounded-xl space-y-4">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider flex-1">Add tracks</p>
          <div className="flex gap-1">
            {(["file", "url"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setInputMode(m)}
                className={`px-3 py-1 text-xs rounded-md transition-colors font-medium border ${
                  inputMode === m
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                    : "text-[var(--muted)] bg-[var(--background)] border-[var(--border)] hover:text-[var(--foreground)]"
                }`}
              >
                {m === "file" ? "↑ Upload" : "URL"}
              </button>
            ))}
          </div>
        </div>

        {inputMode === "file" ? (
          <label className="flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed border-[var(--accent)]/50 hover:border-[var(--accent-light)] hover:bg-[var(--accent)]/5 rounded-xl transition-all cursor-pointer">
            <span className="text-3xl leading-none">♪</span>
            <div className="text-center">
              <p className="text-sm font-medium">Click to choose audio or video files</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">mp3, m4a, wav, aac · mp4, mov, m4v — audio is extracted from video</p>
            </div>
            <input
              type="file"
              accept="audio/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) handleFilesAdd(e.target.files); e.target.value = ""; }}
            />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Track title</label>
              <input
                type="text"
                value={trackTitle}
                onChange={(e) => setTrackTitle(e.target.value)}
                placeholder="e.g. Chapter 1 — The Beginning"
                className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                autoFocus
              />
            </div>
            <form onSubmit={handleAddTrack} className="flex gap-2">
              <input
                type="url"
                value={trackUrl}
                onChange={(e) => setTrackUrl(e.target.value)}
                placeholder="https://example.com/audio.mp3"
                className="flex-1 px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <button
                type="submit"
                disabled={!trackTitle.trim() || !trackUrl.trim()}
                className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors shrink-0"
              >
                Add
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Track list */}
      {customTracks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
            Playlist — {customTracks.length} track{customTracks.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-1.5">
            {customTracks.map((track, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                  track.uploadError
                    ? "bg-red-500/5 border-red-500/20"
                    : "bg-[var(--card)] border-[var(--border)]"
                }`}
              >
                <span className="text-xs text-[var(--muted)] font-mono w-5 shrink-0 text-right">{i + 1}</span>
                {track.uploading ? (
                  <div className="w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin shrink-0" />
                ) : track.uploadError ? (
                  <span className="text-red-400 shrink-0 text-base leading-none">✕</span>
                ) : (
                  <span className="text-green-400 shrink-0 text-base leading-none">✓</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{track.title}</p>
                  {track.uploading && <p className="text-xs text-[var(--muted)] mt-0.5">Uploading…</p>}
                  {track.uploadError && <p className="text-xs text-red-400 mt-0.5">{track.uploadError}</p>}
                </div>
                <button
                  onClick={() => handleRemoveTrack(i)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center text-[var(--muted)] hover:text-red-400 transition-colors rounded text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleCustomContinue}
              disabled={customTracks.some((t) => t.uploading || !t.url)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
            >
              {customTracks.some((t) => t.uploading) && (
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              Continue to Editor →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
