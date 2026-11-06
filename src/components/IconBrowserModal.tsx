"use client";

import { useEffect, useRef, useState } from "react";
import { extractKeywords } from "@/lib/keywords";
import type { YotoIcon } from "@/types";

interface UserIcon {
  displayIconId: string;
  mediaId: string;
  url: string;
  createdAt: string;
}

interface PublicIcon {
  displayIconId: string;
  mediaId: string;
  title: string;
  url: string;
  tags: string[];
}

interface Props {
  episodeTitle?: string;
  selectedIconId?: string | null;
  onSelect: (icon: YotoIcon) => void;
  onClose: () => void;
}

export function IconBrowserModal({ episodeTitle, selectedIconId, onSelect, onClose }: Props) {
  const [tab, setTab] = useState<"mine" | "public" | "game">("mine");
  const [query, setQuery] = useState("");

  const [myIcons, setMyIcons] = useState<UserIcon[]>([]);
  const [myLoading, setMyLoading] = useState(true);

  const [publicIcons, setPublicIcons] = useState<PublicIcon[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);

  const [gameQuery, setGameQuery] = useState("");
  const [gameIcons, setGameIcons] = useState<YotoIcon[]>([]);
  const [gameLoading, setGameLoading] = useState(false);
  const [gameSearched, setGameSearched] = useState(false);
  const gameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/yoto/user-icons")
      .then((r) => r.json())
      .then((d) => setMyIcons(d.icons ?? []))
      .catch(() => {})
      .finally(() => setMyLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== "public" || publicIcons.length > 0) return;
    setPublicLoading(true);
    fetch("/api/yoto/public-icons")
      .then((r) => r.json())
      .then((d) => setPublicIcons(d.icons ?? []))
      .catch(() => {})
      .finally(() => setPublicLoading(false));
  }, [tab, publicIcons.length]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();

  const filteredMine = q
    ? myIcons.filter((ic) => ic.displayIconId.toLowerCase().includes(q))
    : myIcons;

  const filteredPublic = q
    ? publicIcons.filter(
        (ic) =>
          ic.title.toLowerCase().includes(q) ||
          ic.tags.some((t) => t.toLowerCase().includes(q))
      )
    : publicIcons;

  function handleSelectMine(icon: UserIcon) {
    onSelect({
      id: icon.mediaId,
      source: "user-icon",
      title: icon.displayIconId,
      tags: [],
      url: icon.url,
    });
  }

  function handleSelectPublic(icon: PublicIcon) {
    onSelect({
      id: icon.mediaId,
      source: "yoto-library",
      title: icon.title,
      tags: icon.tags,
      url: icon.url,
    });
  }

  async function searchGameIcons(q: string) {
    if (!q.trim()) return;
    setGameLoading(true);
    setGameSearched(true);
    try {
      const res = await fetch(`/api/icons/yotoicons-search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setGameIcons(data.icons ?? []);
    } catch {
      setGameIcons([]);
    } finally {
      setGameLoading(false);
    }
  }

  function openGameTab() {
    setTab("game");
    setQuery("");
    setTimeout(() => gameInputRef.current?.focus(), 50);
  }

  const titleKeywords = episodeTitle ? extractKeywords(episodeTitle) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-3xl bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--border)] shrink-0">
          <div>
            <h2 className="text-sm font-medium">Browse Icons</h2>
            {episodeTitle && (
              <p className="text-xs text-[var(--muted)] mt-0.5 truncate max-w-xs">{episodeTitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition-colors rounded-lg hover:bg-[var(--card)]"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b border-[var(--border)] shrink-0">
          {(["mine", "public"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setQuery(""); }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                tab === t
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t === "mine"
                ? `My Icons${myIcons.length ? ` (${myIcons.length})` : ""}`
                : "Public Library"}
            </button>
          ))}
          <button
            onClick={openGameTab}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              tab === "game"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            yotoicons.com
          </button>
        </div>

        {/* Search — mine + public tabs */}
        {tab !== "game" && (
          <div className="px-4 py-2 border-b border-[var(--border)] shrink-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "mine" ? "Search my icons…" : "Search by name or tag…"}
              autoFocus
              className="w-full px-3 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
        )}

        {/* Grid */}
        <div className="overflow-y-auto flex-1 p-4">
          {tab === "mine" && (
            myLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredMine.length === 0 ? (
              <p className="text-sm text-[var(--muted)] text-center py-8">
                {q ? `No icons match "${query}"` : "No icons uploaded yet"}
              </p>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {filteredMine.map((icon) => {
                  const label = icon.displayIconId.slice(0, 8);
                  const isSelected = icon.mediaId === selectedIconId;
                  return (
                    <button
                      key={icon.displayIconId}
                      type="button"
                      onClick={() => handleSelectMine(icon)}
                      className={`relative group flex flex-col items-center gap-1 p-1 rounded-lg transition-all ${
                        isSelected
                          ? "ring-2 ring-[var(--accent)] bg-[var(--accent)]/10"
                          : "hover:bg-[var(--card)]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded overflow-hidden">
                        <img
                          src={icon.url}
                          alt={label}
                          width={40}
                          height={40}
                          style={{ imageRendering: "pixelated" }}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-[8px] text-[var(--muted)] truncate w-full text-center">{label}</p>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-[var(--foreground)] text-[var(--background)] text-[9px] rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 max-w-[100px] truncate">
                        {label}
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          )}

          {tab === "public" && (
            publicLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredPublic.length === 0 ? (
              <p className="text-sm text-[var(--muted)] text-center py-8">
                {q ? `No icons match "${query}"` : "No public icons found"}
              </p>
            ) : (
              <>
                {q && (
                  <p className="text-xs text-[var(--muted)] mb-3">
                    {filteredPublic.length} result{filteredPublic.length !== 1 ? "s" : ""}
                  </p>
                )}
                <div className="grid grid-cols-7 gap-2">
                  {filteredPublic.map((icon) => {
                    const isSelected = icon.mediaId === selectedIconId;
                    const tooltip = icon.tags.length
                      ? `${icon.title} · ${icon.tags.join(", ")}`
                      : icon.title;
                    return (
                      <button
                        key={icon.displayIconId}
                        type="button"
                        onClick={() => handleSelectPublic(icon)}
                        className={`relative group flex flex-col items-center gap-1 p-1 rounded-lg transition-all ${
                          isSelected
                            ? "ring-2 ring-[var(--accent)] bg-[var(--accent)]/10"
                            : "hover:bg-[var(--card)]"
                        }`}
                      >
                        <div className="w-10 h-10 rounded overflow-hidden">
                          <img
                            src={icon.url}
                            alt={icon.title}
                            width={40}
                            height={40}
                            style={{ imageRendering: "pixelated" }}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <p className="text-[8px] text-[var(--muted)] truncate w-full text-center">{icon.title}</p>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-[var(--foreground)] text-[var(--background)] text-[9px] rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 max-w-[120px] truncate">
                          {tooltip}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )
          )}

          {tab === "game" && (
            <div className="space-y-3">
              {/* Keyword chips from episode title */}
              {titleKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {titleKeywords.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => { setGameQuery(kw); searchGameIcons(kw); }}
                      className="px-2 py-0.5 text-xs rounded-full border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent-light)] hover:text-[var(--accent-light)] transition-colors"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              )}

              {/* Search form */}
              <form
                onSubmit={(e) => { e.preventDefault(); searchGameIcons(gameQuery); }}
                className="flex gap-2"
              >
                <input
                  ref={gameInputRef}
                  type="text"
                  value={gameQuery}
                  onChange={(e) => setGameQuery(e.target.value)}
                  placeholder="Search yotoicons.com (e.g. puppy, dinosaur, pirate)…"
                  className="flex-1 px-3 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
                <button
                  type="submit"
                  disabled={!gameQuery.trim() || gameLoading}
                  className="px-3 py-1.5 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-lg transition-colors shrink-0"
                >
                  {gameLoading ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                      Searching
                    </span>
                  ) : "Search"}
                </button>
              </form>

              {!gameSearched ? (
                <p className="text-sm text-[var(--muted)] text-center py-8">
                  Search community Yoto icons by keyword
                </p>
              ) : gameLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : gameIcons.length === 0 ? (
                <p className="text-sm text-[var(--muted)] text-center py-8">
                  No icons found for &ldquo;{gameQuery}&rdquo;
                </p>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {gameIcons.map((icon) => {
                    const isSelected = icon.id === selectedIconId;
                    return (
                      <button
                        key={icon.id}
                        type="button"
                        onClick={() => onSelect(icon)}
                        title={icon.title}
                        className={`relative group flex flex-col items-center gap-1 p-1 rounded-lg transition-all ${
                          isSelected
                            ? "ring-2 ring-[var(--accent)] bg-[var(--accent)]/10"
                            : "hover:bg-[var(--card)]"
                        }`}
                      >
                        <div className="w-10 h-10 rounded overflow-hidden">
                          <img
                            src={icon.previewDataUrl}
                            alt={icon.title}
                            width={40}
                            height={40}
                            style={{ imageRendering: "pixelated" }}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <p className="text-[8px] text-[var(--muted)] truncate w-full text-center">{icon.title}</p>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-[var(--foreground)] text-[var(--background)] text-[9px] rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 max-w-[120px] truncate">
                          {icon.title}
                        </div>
                        {isSelected && (
                          <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-[var(--accent)] rounded-full flex items-center justify-center">
                            <span className="text-white text-[8px] leading-none">✓</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
