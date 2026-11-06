"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";

export function EpisodeList() {
  const { podcast, episodes, toggleEpisode, setEpisodes, setStep, setPlayer, uploadAudioToYoto, setUploadAudioToYoto } = useAppStore();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "title">("date-desc");
  const [celebrating, setCelebrating] = useState(false);
  const prevAllSelected = useRef(false);

  const filtered = useMemo(() => {
    let list = episodes.filter((ep) => ep.audioUrl);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (ep) =>
          ep.title.toLowerCase().includes(q) ||
          ep.description.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      const diff = new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime();
      return sortBy === "date-asc" ? diff : -diff;
    });

    return list;
  }, [episodes, search, sortBy]);

  const selectedCount = episodes.filter((ep) => ep.selected).length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((ep) => ep.selected);

  useEffect(() => {
    if (allFilteredSelected && !prevAllSelected.current) {
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), 700);
      return () => clearTimeout(t);
    }
    prevAllSelected.current = allFilteredSelected;
  }, [allFilteredSelected]);

  function formatDuration(dur: string): string {
    if (!dur) return "";
    const parts = dur.split(":").map(Number);
    if (parts.length === 3) {
      const [h, m] = parts;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
    if (parts.length === 1) {
      const secs = parts[0];
      const mins = Math.floor(secs / 60);
      return mins > 60
        ? `${Math.floor(mins / 60)}h ${mins % 60}m`
        : `${mins}m`;
    }
    return dur;
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">{podcast?.title}</h2>
          <p className="text-sm text-[var(--muted)]">
            {filtered.length} episodes available
          </p>
        </div>
        <button
          onClick={() => setStep("search")}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          Change podcast
        </button>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter episodes..."
          className="flex-1 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "date-desc" | "date-asc" | "title")}
          className="px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="title">A-Z</option>
        </select>
      </div>

      <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1 pb-20">
        {filtered.map((episode) => (
          <button
            key={episode.guid}
            onClick={() => toggleEpisode(episode.guid)}
            className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
              episode.selected
                ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30"
                : "bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--card-hover)]"
            }`}
          >
            <div
              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                episode.selected
                  ? "bg-[var(--accent)] border-[var(--accent)]"
                  : "border-[var(--border)]"
              }`}
            >
              <span className={`text-white text-xs transition-transform duration-150 origin-center ${episode.selected ? "scale-100" : "scale-0"}`}>✓</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium truncate">{episode.title}</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-[var(--muted)]">
                  {formatDate(episode.pubDate)}
                </span>
                {episode.duration && (
                  <span className="text-xs text-[var(--muted)]">
                    {formatDuration(episode.duration)}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setPlayer(episode.audioUrl, episode.title); }}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--accent-light)] hover:border-[var(--accent-light)] transition-colors text-xs"
              title="Preview"
            >
              ▶
            </button>
          </button>
        ))}
      </div>

      <label className="flex items-start gap-2 pt-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={uploadAudioToYoto}
          onChange={(e) => setUploadAudioToYoto(e.target.checked)}
          className="mt-0.5 accent-[var(--accent)]"
        />
        <span className="text-sm">
          Upload audio to Yoto for scrubbing
          <span className="block text-xs text-[var(--muted)]">
            Slower; falls back to streaming on failure.
          </span>
        </span>
      </label>

      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
        <div className="flex items-center gap-3">
          <p className={`text-sm transition-colors duration-300 ${celebrating ? "text-[var(--accent-light)] font-medium" : "text-[var(--muted)]"}`}>
            {selectedCount} episode{selectedCount !== 1 ? "s" : ""} selected
          </p>
          <button
            onClick={() => {
              const allSelected = filtered.every((ep) => ep.selected);
              setEpisodes(episodes.map((ep) =>
                filtered.some((f) => f.guid === ep.guid)
                  ? { ...ep, selected: !allSelected }
                  : ep
              ));
            }}
            className="text-xs text-[var(--accent-light)] hover:underline"
          >
            {filtered.every((ep) => ep.selected) ? "Deselect all" : "Select all"}
          </button>
        </div>
        <button
          onClick={() => {
            // Persist current sort order to the store so downstream wizard steps
            // (icons, review) iterate episodes in the same order the user just saw.
            const sorted = [...episodes].sort((a, b) => {
              if (sortBy === "title") return a.title.localeCompare(b.title);
              const diff = new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime();
              return sortBy === "date-asc" ? diff : -diff;
            });
            setEpisodes(sorted);
            setStep("icons");
          }}
          disabled={selectedCount === 0}
          className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
