"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { PlaylistEditor } from "@/components/PlaylistEditor";

export default function EditorPage() {
  const { cardId: cardIdParam } = useParams<{ cardId: string }>();
  const router = useRouter();
  const { setStep, setSelectedCard, setEditingCardId, setPlaylistTracks, setSavedSnapshot } = useAppStore();
  const editingCardId = useAppStore((s) => s.editingCardId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Auth gate first.
      try {
        const status = await fetch("/api/yoto/status").then((r) => r.json());
        if (!status.connected) {
          router.replace("/");
          return;
        }
      } catch {
        router.replace("/");
        return;
      }

      // If the store already has this card loaded (e.g. user is returning from
      // /tracks/new or /icons), skip the refetch — otherwise we'd clobber any
      // unsaved local changes the user made before hitting Save to Yoto.
      if (editingCardId === cardIdParam) {
        setStep("editor");
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/yoto/cards/${cardIdParam}`);
        if (!res.ok) {
          if (!cancelled) setError(res.status === 404 ? "Playlist not found" : `Failed to load: ${res.status}`);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setSelectedCard({ cardId: data.cardId, title: data.title, slug: data.slug ?? "", coverImage: data.coverImage ?? null, description: data.description ?? "" });
        setEditingCardId(data.cardId);
        type Ch = { key: string; title: string; iconRef?: string; iconPreviewUrl?: string; trackUrl?: string; duration?: number; fileSize?: number; channels?: string; format?: string };
        setPlaylistTracks((data.chapters ?? []).map((ch: Ch, i: number) => {
          const trackUrl = ch.trackUrl ?? "";
          // For uploaded tracks, point sourceAudioUrl at the proxy so the trim
          // modal/scrubber can fetch the bytes (cache hit locally, or pulled
          // from Yoto's CDN on demand via ensureYotoTrackCached).
          const sourceAudioUrl = trackUrl.startsWith("http")
            ? trackUrl
            : trackUrl.startsWith("yoto:#")
              ? `/api/podcasts/audio?${new URLSearchParams({ ref: trackUrl, cardId: data.cardId })}`
              : undefined;
          return {
            key: String(i + 1).padStart(2, "0"),
            title: ch.title,
            trackUrl,
            iconRef: ch.iconRef ?? "",
            iconPreviewUrl: ch.iconPreviewUrl ?? (ch.iconRef?.startsWith("http") ? ch.iconRef : undefined),
            sourceAudioUrl,
            duration: ch.duration,
            fileSize: ch.fileSize,
            channels: ch.channels,
            format: ch.format,
          };
        }));
        // Fresh server data — let PlaylistEditor re-baseline its dirty check.
        setSavedSnapshot(null);
        setStep("editor");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cardIdParam, editingCardId, router, setSelectedCard, setEditingCardId, setPlaylistTracks, setSavedSnapshot, setStep]);

  return (
    <AppShell>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => router.push("/library")}
            className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors"
          >
            ← Back to library
          </button>
        </div>
      ) : (
        <PlaylistEditor />
      )}
    </AppShell>
  );
}
