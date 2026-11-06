"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { extractKeywords } from "@/lib/keywords";
import { IconCandidate } from "@/components/IconCandidate";
import { IconBrowserModal } from "@/components/IconBrowserModal";
import type { YotoIcon, PlaylistTrack } from "@/types";

function parseRssDuration(s: string | undefined): number | undefined {
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

function stripHtml(s: string): string {
  if (!s) return "";
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

const SOURCE_LABELS: Record<YotoIcon["source"], string> = {
  "emoji": "Emoji",
  "game-icons": "Game Icons",
  "yotoicons-com": "yotoicons.com",
  "yoto-library": "Yoto Library",
  "user-icon": "My Icons",
  "artwork-downscale": "Artwork",
  "ai-generated": "AI Generated",
  "custom": "Custom",
};

export function IconPicker() {
  const {
    podcast,
    episodes,
    iconSelections,
    setIconSelections,
    upsertIconSelection,
    selectIcon,
    setStep,
    playlistTracks,
    setPlaylistTracks,
    appendPlaylistTracks,
    editingTrackKey,
    updatePlaylistTrack,
    setEditingTrackKey,
    editingAllTrackIcons,
    setEditingAllTrackIcons,
    uploadAudioToYoto,
    setResolvedIconsByGuid,
    toggleEpisode,
  } = useAppStore();

  const selectedEpisodes = episodes.filter((ep) => ep.selected);
  const [loadingEpisodes, setLoadingEpisodes] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const initialized = useRef(false);
  const [modalEpisode, setModalEpisode] = useState<{ guid: string; title: string } | null>(null);
  // tracks "guid:keyword" strings that are currently loading or already searched
  const [yotoSearching, setYotoSearching] = useState<Set<string>>(new Set());
  const [yotoSearched, setYotoSearched] = useState<Set<string>>(new Set());
  const [yotoInputs, setYotoInputs] = useState<Record<string, string>>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<{ guid: string; title: string } | null>(null);
  const [isAutoNumbering, setIsAutoNumbering] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("yoto_connected") || url.searchParams.has("yoto_error")) {
        url.searchParams.delete("yoto_connected");
        url.searchParams.delete("yoto_error");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, []);

  const loadIconsForEpisode = useCallback(
    async (episodeGuid: string, title: string, artworkUrl?: string) => {
      setLoadingEpisodes((prev) => new Set(prev).add(episodeGuid));
      try {
        const res = await fetch("/api/icons/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodeTitle: title, artworkUrl, podcastTitle: podcast?.title }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const icons: YotoIcon[] = data.icons;
        const defaultId = (
          icons.find((ic) => ic.source === "yoto-library") ??
          icons.find((ic) => ic.source === "emoji") ??
          icons[0]
        )?.id ?? null;
        upsertIconSelection(episodeGuid, icons, defaultId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load icons");
      } finally {
        setLoadingEpisodes((prev) => {
          const next = new Set(prev);
          next.delete(episodeGuid);
          return next;
        });
      }
    },
    [upsertIconSelection]
  );


  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    for (const episode of selectedEpisodes) {
      const existing = iconSelections.find((s) => s.episodeGuid === episode.guid);
      if (!existing || existing.candidates.length <= 1) {
        loadIconsForEpisode(episode.guid, episode.title, episode.artworkUrl);
      }
    }
  }, [selectedEpisodes, iconSelections, loadIconsForEpisode]);

  async function handleCustomUpload(episodeGuid: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/icons/convert", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const customIcon: YotoIcon = {
        id: `custom-${Date.now()}`,
        source: "custom",
        title: file.name,
        tags: [],
        url: "",
        previewDataUrl: data.dataUrl,
      };
      setIconSelections(
        iconSelections.map((s) =>
          s.episodeGuid === episodeGuid
            ? { ...s, candidates: [...s.candidates, customIcon], selectedIconId: customIcon.id }
            : s
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  const allHaveIcons = selectedEpisodes.every((ep) => {
    const sel = iconSelections.find((s) => s.episodeGuid === ep.guid);
    return sel?.selectedIconId;
  });

  async function resolveIconRef(icon: YotoIcon, filename: string): Promise<string> {
    if (icon.source === "yoto-library" || icon.source === "user-icon") {
      return `yoto:#${icon.id}`;
    }
    const imageDataUrl = icon.previewDataUrl;
    if (!imageDataUrl) return "";
    const body = icon.url?.startsWith("http")
      ? { sourceUrl: icon.url, filename }
      : { imageDataUrl, filename };

    const uploadRes = await fetch("/api/yoto/upload-icon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!uploadRes.ok) {
      const data = await uploadRes.json().catch(() => ({}));
      throw new Error(data.error || `Icon upload failed (${uploadRes.status})`);
    }
    const { mediaId } = await uploadRes.json();
    return mediaId ? `yoto:#${mediaId}` : "";
  }

  async function handleUpdateTrackIcon() {
    if (!editingTrackKey) return;
    setIsCommitting(true);
    setError("");
    try {
      const ep = selectedEpisodes[0];
      if (!ep) return;
      const sel = iconSelections.find((s) => s.episodeGuid === ep.guid);
      const icon = sel?.candidates.find((c) => c.id === sel.selectedIconId);

      let iconRef = "";
      let iconPreviewUrl: string | undefined;

      if (icon) {
        iconPreviewUrl = icon.previewDataUrl || icon.url || undefined;
        iconRef = await resolveIconRef(icon, `icon-${ep.guid}.png`);
      }

      updatePlaylistTrack(editingTrackKey, { iconRef, iconPreviewUrl });
      setEditingTrackKey(null);
      setStep("editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save icon");
    } finally {
      setIsCommitting(false);
    }
  }

  async function handleUpdateAllTrackIcons() {
    setIsCommitting(true);
    setError("");
    try {
      for (const ep of selectedEpisodes) {
        const sel = iconSelections.find((s) => s.episodeGuid === ep.guid);
        const icon = sel?.candidates.find((c) => c.id === sel.selectedIconId);
        let iconRef = "";
        let iconPreviewUrl: string | undefined;
        if (icon) {
          iconPreviewUrl = icon.previewDataUrl || icon.url || undefined;
          iconRef = await resolveIconRef(icon, `icon-${ep.guid}.png`);
        }
        updatePlaylistTrack(ep.guid, { iconRef, iconPreviewUrl });
      }
      setEditingAllTrackIcons(false);
      setStep("editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save icon");
    } finally {
      setIsCommitting(false);
    }
  }

  async function handleAddToPlaylist() {
    setIsCommitting(true);
    setError("");
    try {
      const resolved: Record<string, { iconRef: string; iconPreviewUrl?: string }> = {};
      for (const ep of selectedEpisodes) {
        const sel = iconSelections.find((s) => s.episodeGuid === ep.guid);
        const icon = sel?.candidates.find((c) => c.id === sel.selectedIconId);
        if (icon) {
          resolved[ep.guid] = {
            iconRef: await resolveIconRef(icon, `icon-${ep.guid}.png`),
            iconPreviewUrl: icon.previewDataUrl || icon.url || undefined,
          };
        } else {
          resolved[ep.guid] = { iconRef: "" };
        }
      }
      setResolvedIconsByGuid(resolved);

      if (uploadAudioToYoto) {
        // Hand off to ReviewStep — it owns trim + upload.
        setStep("review");
      } else {
        // No upload — go straight to editor with streaming URLs.
        const updatedTracks = [...playlistTracks];
        const newTracks: PlaylistTrack[] = [];
        for (const ep of selectedEpisodes) {
          const r = resolved[ep.guid] ?? { iconRef: "" };
          const existingIndex = updatedTracks.findIndex((t) => t.episodeGuid === ep.guid);
          const duration = parseRssDuration(ep.duration);
          if (existingIndex >= 0) {
            updatedTracks[existingIndex] = { ...updatedTracks[existingIndex], title: ep.title, trackUrl: ep.audioUrl, iconRef: r.iconRef, iconPreviewUrl: r.iconPreviewUrl, sourceAudioUrl: ep.audioUrl, duration };
          } else {
            newTracks.push({ key: "", title: ep.title, trackUrl: ep.audioUrl, iconRef: r.iconRef, iconPreviewUrl: r.iconPreviewUrl, episodeGuid: ep.guid, sourceAudioUrl: ep.audioUrl, duration });
          }
        }
        const combined = [
          ...updatedTracks,
          ...newTracks.map((t, i) => ({ ...t, key: String(updatedTracks.length + i + 1).padStart(2, "0") })),
        ];
        setPlaylistTracks(combined);
        setStep("editor");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tracks");
    } finally {
      setIsCommitting(false);
    }
  }

  function selectUserIcon(episodeGuid: string, icon: YotoIcon) {
    const existing = iconSelections.find((s) => s.episodeGuid === episodeGuid);
    if (!existing) {
      setIconSelections([...iconSelections, { episodeGuid, candidates: [icon], selectedIconId: icon.id }]);
    } else if (!existing.candidates.some((c) => c.id === icon.id)) {
      setIconSelections(iconSelections.map((s) =>
        s.episodeGuid === episodeGuid ? { ...s, candidates: [...s.candidates, icon] } : s
      ));
    }
    selectIcon(episodeGuid, icon.id);
    setModalEpisode(null);
  }

  async function searchYotoIconsForEpisode(episodeGuid: string, keyword: string) {
    const key = `${episodeGuid}:${keyword}`;
    if (yotoSearching.has(key) || yotoSearched.has(key)) return;
    setYotoSearching((prev) => new Set(prev).add(key));
    try {
      const res = await fetch(`/api/icons/yotoicons-search?q=${encodeURIComponent(keyword)}`);
      const data = await res.json();
      const icons: YotoIcon[] = data.icons ?? [];
      if (icons.length > 0) upsertIconSelection(episodeGuid, icons, null);
    } catch { /* silent */ } finally {
      setYotoSearching((prev) => { const s = new Set(prev); s.delete(key); return s; });
      setYotoSearched((prev) => new Set(prev).add(key));
    }
  }

  async function handleAutoNumberIcons() {
    setIsAutoNumbering(true);
    setError("");
    try {
      for (let i = 0; i < selectedEpisodes.length; i++) {
        const episode = selectedEpisodes[i];
        const res = await fetch("/api/icons/yoto-library-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: [`numbers - ${i + 1}`, String(i + 1)] }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const icons: YotoIcon[] = data.icons ?? [];
        if (icons.length > 0) {
          upsertIconSelection(episode.guid, [icons[0]], null);
          selectIcon(episode.guid, icons[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-number failed");
    } finally {
      setIsAutoNumbering(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Pick Icons</h2>
          <p className="text-sm text-[var(--muted)]">
            Choose a 16×16 pixel art icon for each episode
          </p>
        </div>
        <button
          onClick={() => {
            if (editingTrackKey) { setEditingTrackKey(null); setStep("editor"); }
            else if (editingAllTrackIcons) { setEditingAllTrackIcons(false); setStep("editor"); }
            else setStep("episodes");
          }}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          ← Back
        </button>
      </div>

      {editingAllTrackIcons && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg">
          <span className="text-xs text-[var(--muted)] flex-1">
            Auto-select a number icon from the Yoto library for each track in order.
          </span>
          <button
            type="button"
            onClick={handleAutoNumberIcons}
            disabled={isAutoNumbering || loadingEpisodes.size > 0}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent-light)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {isAutoNumbering ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                Numbering…
              </span>
            ) : "Auto-number icons"}
          </button>
        </div>
      )}

      {loadingEpisodes.size > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--muted)]">Finding icons…</span>
            <span className="text-xs text-[var(--muted)]">{selectedEpisodes.length - loadingEpisodes.size} / {selectedEpisodes.length}</span>
          </div>
          <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
              style={{ width: `${((selectedEpisodes.length - loadingEpisodes.size) / selectedEpisodes.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {selectedEpisodes.map((episode) => {
          const selection = iconSelections.find((s) => s.episodeGuid === episode.guid);
          const isLoading = loadingEpisodes.has(episode.guid);

          const selectedIcon = selection?.candidates.find((c) => c.id === selection.selectedIconId);
          const kws = extractKeywords(episode.title);
          const inputVal = yotoInputs[episode.guid] ?? "";
          const isSearching = yotoSearching.has(`${episode.guid}:${inputVal}`);

          return (
            <div
              key={episode.guid}
              className="relative p-5 bg-[var(--card)] border border-[var(--border)] rounded-xl space-y-3"
            >
              <button
                type="button"
                onClick={() => setConfirmRemove({ guid: episode.guid, title: episode.title })}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-[var(--muted)] hover:text-red-400 transition-colors rounded text-base leading-none"
                aria-label="Remove episode"
                title="Remove this episode"
              >
                ×
              </button>
              {/* Row 1: Icon preview + title */}
              <div className="flex items-center gap-3 pr-6">
                <div className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-[var(--border)] ${
                  selectedIcon ? "bg-[var(--background)]" : "bg-[var(--background)] flex items-center justify-center"
                }`}>
                  {selectedIcon ? (
                    <img
                      src={selectedIcon.previewDataUrl || selectedIcon.url}
                      alt=""
                      width={56}
                      height={56}
                      style={{ imageRendering: "pixelated" }}
                      className="w-full h-full"
                    />
                  ) : (
                    <span className="text-[var(--border)] text-lg">?</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium leading-snug">{episode.title}</h3>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {selectedIcon ? (
                      <>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-light)]">
                          {SOURCE_LABELS[selectedIcon.source]}
                        </span>
                        {selectedIcon.source !== "emoji" && selectedIcon.title && (
                          <>
                            <span className="text-[10px] text-[var(--border)]">·</span>
                            <span className="text-[10px] text-[var(--muted)] truncate">{selectedIcon.title}</span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-[var(--muted)]">No icon selected</span>
                    )}
                  </div>
                </div>
              </div>

              {(() => {
                const cleaned = stripHtml(episode.description);
                if (!cleaned) return null;
                const expanded = expandedDescriptions.has(episode.guid);
                const isLong = cleaned.length > 240;
                return (
                  <div className="text-xs text-[var(--muted)] leading-relaxed">
                    <p className={!expanded && isLong ? "line-clamp-3" : ""}>{cleaned}</p>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => setExpandedDescriptions((prev) => {
                          const next = new Set(prev);
                          if (next.has(episode.guid)) next.delete(episode.guid);
                          else next.add(episode.guid);
                          return next;
                        })}
                        className="text-[10px] text-[var(--accent-light)] hover:underline mt-1"
                      >
                        {expanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                );
              })()}

              {isLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-[var(--muted)]">Finding icons…</span>
                </div>
              ) : (
                <>
                  {/* Row 2: Icon grid */}
                  <div className="flex flex-wrap gap-1.5">
                    {(selection?.candidates ?? []).map((icon) => (
                      <IconCandidate
                        key={icon.id}
                        icon={icon}
                        isSelected={selection?.selectedIconId === icon.id}
                        onSelect={() => selectIcon(episode.guid, icon.id)}
                      />
                    ))}
                    {(!selection || selection.candidates.length === 0) && (
                      <button
                        onClick={() => loadIconsForEpisode(episode.guid, episode.title, episode.artworkUrl)}
                        className="px-3 py-1.5 text-xs border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent-light)] rounded-lg transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>

                  {/* Row 3: Search + browse/upload */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const val = inputVal.trim();
                      if (val) searchYotoIconsForEpisode(episode.guid, val);
                    }}
                    className="space-y-2 pt-2 border-t border-[var(--border)]"
                  >
                    {/* Keyword chips — directly above the search input */}
                    {kws.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {kws.map((kw) => {
                          const key = `${episode.guid}:${kw}`;
                          const loading = yotoSearching.has(key);
                          const done = yotoSearched.has(key);
                          return (
                            <button
                              key={kw}
                              type="button"
                              onClick={() => searchYotoIconsForEpisode(episode.guid, kw)}
                              disabled={loading || done}
                              className={`px-2.5 py-1 text-[10px] rounded-full border transition-colors disabled:cursor-default ${
                                done
                                  ? "border-[var(--accent)]/40 text-[var(--accent-light)]/60"
                                  : loading
                                  ? "border-[var(--border)] text-[var(--muted)] opacity-60"
                                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent-light)] hover:text-[var(--accent-light)]"
                              }`}
                            >
                              {loading ? (
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                                  {kw}
                                </span>
                              ) : done ? `${kw} ✓` : kw}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputVal}
                      onChange={(e) => setYotoInputs((prev) => ({ ...prev, [episode.guid]: e.target.value }))}
                      placeholder="Search yotoicons.com…"
                      className="flex-1 min-w-0 px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!inputVal.trim() || isSearching}
                      className="px-3 py-2 text-sm rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-medium transition-colors shrink-0"
                    >
                      {isSearching ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                          Searching
                        </span>
                      ) : "Search"}
                    </button>
                    <div className="flex rounded-lg border border-[var(--border)] overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => setModalEpisode({ guid: episode.guid, title: episode.title })}
                        className="px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors border-r border-[var(--border)]"
                      >
                        Browse
                      </button>
                      <label className="px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors cursor-pointer">
                        ↑ Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleCustomUpload(episode.guid, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    </div>
                  </form>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
        <p className="text-sm text-[var(--muted)]">
          {allHaveIcons ? "All episodes have icons" : "Select an icon for each episode"}
        </p>
        {editingTrackKey ? (
          <button
            onClick={handleUpdateTrackIcon}
            disabled={!allHaveIcons || isCommitting}
            className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
          >
            {isCommitting ? "Uploading…" : "Update icon →"}
          </button>
        ) : editingAllTrackIcons ? (
          <button
            onClick={handleUpdateAllTrackIcons}
            disabled={!allHaveIcons || isCommitting}
            className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
          >
            {isCommitting ? "Uploading…" : "Update all icons →"}
          </button>
        ) : (
          <button
            onClick={handleAddToPlaylist}
            disabled={!allHaveIcons || isCommitting}
            className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
          >
            {isCommitting
              ? "Preparing icons…"
              : uploadAudioToYoto
                ? "Continue →"
                : "Add to playlist →"}
          </button>
        )}
      </div>

      {modalEpisode && (
        <IconBrowserModal
          episodeTitle={modalEpisode.title}
          selectedIconId={
            iconSelections.find((s) => s.episodeGuid === modalEpisode.guid)?.selectedIconId ?? null
          }
          onSelect={(icon) => selectUserIcon(modalEpisode.guid, icon)}
          onClose={() => setModalEpisode(null)}
        />
      )}

      {confirmRemove && (
        <RemoveEpisodeConfirm
          title={confirmRemove.title}
          onConfirm={() => { toggleEpisode(confirmRemove.guid); setConfirmRemove(null); }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}

function RemoveEpisodeConfirm({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-2xl p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="font-medium">Remove episode?</h3>
          <p className="text-sm text-[var(--muted)]">
            <span className="text-[var(--foreground)]">{title}</span> will be removed from this playlist. You can re-select it from the episode list.
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
