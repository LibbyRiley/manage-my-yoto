"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import type { PlaylistTrack } from "@/types";

interface Card {
  cardId: string;
  title: string;
  cardType: string;
  slug: string;
  coverImage: string | null;
  trackCount: number | null;
}

interface Chapter {
  key: string;
  title: string;
  iconRef: string;
  iconPreviewUrl?: string;
  trackUrl: string;
}

function yotoCoverSrc(url: string) {
  return url.startsWith("https://api.yotoplay.com/")
    ? `/api/yoto/media-proxy?url=${encodeURIComponent(url)}`
    : url;
}

// Deterministic gradient from card ID
function cardGradient(cardId: string) {
  const hues = [220, 260, 190, 340, 30, 160, 280, 10];
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) hash = (hash * 31 + cardId.charCodeAt(i)) | 0;
  const h1 = hues[Math.abs(hash) % hues.length];
  const h2 = hues[Math.abs(hash >> 4) % hues.length];
  return `linear-gradient(135deg, hsl(${h1},60%,25%) 0%, hsl(${h2},50%,18%) 100%)`;
}

export function YotoLibrary() {
  const { setStep, setSelectedCard, setEditingCardId, setPlaylistTracks, setSavedSnapshot } = useAppStore();
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingCard, setLoadingCard] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<Card | null>(null);
  const [deleting, setDeleting] = useState(false);
  const prefetchCache = useRef<Map<string, Promise<Record<string, unknown>>>>(new Map());

  function prefetchCard(cardId: string) {
    if (prefetchCache.current.has(cardId)) return;
    prefetchCache.current.set(cardId, fetch(`/api/yoto/cards/${cardId}`).then((r) => r.json()));
  }

  useEffect(() => {
    fetch("/api/yoto/cards")
      .then((r) => r.json())
      .then((d) => setCards(d.cards ?? []))
      .catch(() => setError("Failed to load cards"))
      .finally(() => setLoading(false));
  }, []);

  async function editCard(card: Card) {
    setLoadingCard(card.cardId);
    setSelectedCard({ cardId: card.cardId, title: card.title, slug: card.slug, coverImage: card.coverImage });
    setEditingCardId(card.cardId);
    const cached = prefetchCache.current.get(card.cardId);
    try {
      const data = await (cached ?? fetch(`/api/yoto/cards/${card.cardId}`).then((r) => r.json()));
      const tracks: PlaylistTrack[] = (data.chapters ?? []).map(
        (ch: Chapter, i: number) => ({
          key: String(i + 1).padStart(2, "0"),
          title: ch.title,
          trackUrl: ch.trackUrl ?? "",
          iconRef: ch.iconRef ?? "",
          iconPreviewUrl: ch.iconPreviewUrl ?? (ch.iconRef?.startsWith("http") ? ch.iconRef : undefined),
        })
      );
      setPlaylistTracks(tracks);
      setSelectedCard({ cardId: card.cardId, title: card.title, slug: card.slug, coverImage: card.coverImage, description: data.description ?? "" });
      // Fresh server data — let PlaylistEditor re-baseline its dirty check.
      setSavedSnapshot(null);
    } catch {
      setPlaylistTracks([]);
    }
    // Keep loadingCard set — spinner stays visible through router.push until the
    // component unmounts on navigation. Avoids a flicker where the spinner clears
    // before Next.js has actually transitioned to the editor route.
    router.push(`/editor/${card.cardId}`);
  }

  async function deleteCard(card: Card) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/yoto/cards/${card.cardId}`, { method: "DELETE" });
      if (res.ok) setCards((prev) => prev.filter((c) => c.cardId !== card.cardId));
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  function createNew() {
    setSelectedCard(null);
    setEditingCardId(null);
    setPlaylistTracks([]);
    setStep("search");
    router.push("/create");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Playlist Library</h2>
          <p className="text-sm text-[var(--muted)]">{cards.length} playlist{cards.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {/* New playlist card */}
        <button
          onClick={createNew}
          className="group flex flex-col rounded-xl overflow-hidden border border-dashed border-[var(--border)] hover:border-[var(--accent-light)] transition-colors text-left"
        >
          <div className="aspect-[2/3] bg-[var(--card)] flex items-center justify-center">
            <span className="text-3xl text-[var(--muted)] group-hover:text-[var(--accent-light)] transition-colors">+</span>
          </div>
          <div className="p-2.5">
            <p className="text-xs font-medium text-[var(--accent-light)]">Create new playlist</p>
          </div>
        </button>

        {/* Existing cards */}
        {cards.map((card, index) => (
          <div
            key={card.cardId}
            className="group relative flex flex-col rounded-xl overflow-hidden border border-[var(--border)] hover:border-[var(--accent-light)] transition-all"
            style={{ animation: "fadeInUp 250ms ease both", animationDelay: `${index * 60}ms` }}
            onMouseEnter={() => prefetchCard(card.cardId)}
          >
            {/* Cover art — clickable to edit */}
            <button
              onClick={() => editCard(card)}
              disabled={loadingCard === card.cardId}
              className="aspect-[2/3] relative overflow-hidden w-full disabled:opacity-60"
            >
              {/* Gradient placeholder — always visible until image loads */}
              <div className="absolute inset-0" style={{ background: cardGradient(card.cardId) }} />
              {card.coverImage && (
                <img
                  src={yotoCoverSrc(card.coverImage)}
                  alt={card.title}
                  className={`absolute inset-0 w-full h-full object-cover transition-[opacity,filter] duration-500 ${
                    loadedImages.has(card.cardId)
                      ? "opacity-100 blur-0"
                      : "opacity-0 blur-md"
                  }`}
                  onLoad={() => setLoadedImages((prev) => new Set(prev).add(card.cardId))}
                />
              )}

              {loadingCard === card.cardId ? (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                </div>
              )}
            </button>

            {/* Card info + delete */}
            <div className="p-2.5 flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{card.title}</p>
                {card.trackCount !== null && (
                  <p className="text-[10px] text-[var(--muted)] mt-0.5">
                    {card.trackCount} track{card.trackCount !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(card); }}
                className="shrink-0 w-5 h-5 flex items-center justify-center text-[var(--muted)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 rounded"
                aria-label="Delete playlist"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-sm bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-2xl p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="font-medium">Delete playlist?</h3>
              <p className="text-sm text-[var(--muted)]">
                <span className="text-[var(--foreground)]">{confirmDelete.title}</span> will be permanently removed from your Yoto library. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCard(confirmDelete)}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {deleting && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
