"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { PRESET_STATIONS, STATION_CATEGORIES } from "@/lib/radio-stations";
import type { StationCategory } from "@/lib/radio-stations";

const CATEGORY_COLORS: Record<StationCategory, string> = {
  "Australia":    "bg-[#2dc653]/15 text-[#2dc653]",
  "Kids":         "bg-[#f5a623]/15 text-[#f5a623]",
  "Public Radio": "bg-[var(--accent)]/15 text-[var(--accent-light)]",
  "Music":        "bg-[#a855f7]/15 text-[#a855f7]",
};

interface Props {
  onBack: () => void;
}

export function RadioStationPicker({ onBack }: Props) {
  const { appendPlaylistTracks, playlistTracks, setStep } = useAppStore();
  const [activeCategory, setActiveCategory] = useState<StationCategory | "All">("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customUrl, setCustomUrl] = useState("");
  const [customName, setCustomName] = useState("");

  const filtered = PRESET_STATIONS.filter(
    (s) => activeCategory === "All" || s.category === activeCategory
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    const stations = PRESET_STATIONS.filter((s) => selected.has(s.id));
    const startKey = playlistTracks.length + 1;

    const tracks = stations.map((s, i) => ({
      key: String(startKey + i).padStart(2, "0"),
      title: s.name,
      trackUrl: s.streamUrl,
      iconRef: "",
      episodeGuid: `radio-${s.id}`,
    }));

    if (customUrl.trim()) {
      tracks.push({
        key: String(startKey + tracks.length).padStart(2, "0"),
        title: customName.trim() || customUrl.trim(),
        trackUrl: customUrl.trim(),
        iconRef: "",
        episodeGuid: `radio-custom-${Date.now()}`,
      });
    }

    if (tracks.length === 0) return;
    appendPlaylistTracks(tracks);
    setStep("editor");
  }

  const hasSelection = selected.size > 0 || customUrl.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium text-lg">Radio Stations</h2>
          <p className="text-sm text-[var(--muted)] mt-0.5">Pick one or more stations to add to your playlist</p>
        </div>
        <button onClick={onBack} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          ← Back
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {(["All", ...STATION_CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
              activeCategory === cat
                ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent-light)]/50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Station list */}
      <div className="space-y-2">
        {filtered.map((station) => {
          const isSelected = selected.has(station.id);
          return (
            <button
              key={station.id}
              type="button"
              onClick={() => toggle(station.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? "bg-[var(--accent)]/8 border-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                  : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent-light)]/50"
              }`}
            >
              <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                isSelected ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border)]"
              }`}>
                {isSelected && <span className="text-white text-[9px] leading-none">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{station.name}</span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded ${CATEGORY_COLORS[station.category]}`}>
                    {station.category}
                  </span>
                </div>
                {station.description && (
                  <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{station.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom URL */}
      <div className="p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl space-y-3">
        <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Custom stream URL</p>
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Station name"
          className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <input
          type="url"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          placeholder="https://stream.example.com/radio.mp3"
          className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-sm text-[var(--muted)]">
          {selected.size > 0
            ? `${selected.size} station${selected.size !== 1 ? "s" : ""} selected`
            : "No stations selected"}
        </p>
        <button
          onClick={handleAdd}
          disabled={!hasSelection}
          className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
        >
          Add to playlist →
        </button>
      </div>
    </div>
  );
}
