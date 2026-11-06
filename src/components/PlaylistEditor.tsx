"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, LayoutGroup } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import type { PlaylistTrack, YotoIcon, IconSelection } from "@/types";
import { IconBrowserModal } from "@/components/IconBrowserModal";
import { TrimModal } from "@/components/TrimModal";

interface TrackRowProps {
  track: PlaylistTrack;
  index: number;
  iconSrc: string | null;
  onEditIcon: () => void;
  onDelete: () => void;
  onPlay: () => void;
  onTitleChange: (v: string) => void;
  onTitleBlur: () => void;
  onReupload?: () => void;
  onTrim?: () => void;
  reuploading?: boolean;
}

function formatTrimTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function transcodeMetaPatch(result: { duration?: number; fileSize?: number; channels?: string; format?: string }): Partial<PlaylistTrack> {
  return {
    ...(result.duration !== undefined ? { duration: result.duration } : {}),
    ...(result.fileSize !== undefined ? { fileSize: result.fileSize } : {}),
    ...(result.channels ? { channels: result.channels } : {}),
    ...(result.format ? { format: result.format } : {}),
  };
}

function SortableTrackRow({ track, index, iconSrc, onEditIcon, onDelete, onPlay, onTitleChange, onTitleBlur, onReupload, onTrim, reuploading }: TrackRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.key });

  if (isDragging) {
    return (
      <motion.div
        ref={setNodeRef}
        layout
        className="h-14 rounded-lg border-2 border-dashed border-[var(--accent)]/20 bg-transparent"
      />
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        opacity: { duration: 0.15, delay: index * 0.03 },
        y: { duration: 0.15, delay: index * 0.03 },
        layout: { type: "spring", stiffness: 400, damping: 35 },
      }}
      className="flex items-center gap-2 p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 flex flex-col gap-[3px] items-center justify-center cursor-grab active:cursor-grabbing text-[var(--muted)] hover:text-[var(--foreground)] transition-colors px-0.5 py-1 rounded"
        aria-label="Drag to reorder"
        tabIndex={0}
      >
        <span className="w-3 h-px bg-current block" />
        <span className="w-3 h-px bg-current block" />
        <span className="w-3 h-px bg-current block" />
      </button>

      <button
        onClick={onEditIcon}
        title="Edit icon"
        className="w-7 h-7 rounded shrink-0 overflow-hidden hover:ring-2 hover:ring-[var(--accent)] transition-all"
        style={{ imageRendering: "pixelated" }}
      >
        {iconSrc ? (
          <img src={iconSrc} alt="" width={28} height={28} className="w-full h-full object-cover" style={{ imageRendering: "pixelated" }} />
        ) : (
          <div className="w-full h-full bg-[var(--accent)]/20 rounded flex items-center justify-center">
            <span className="text-[8px] text-[var(--accent-light)]">+</span>
          </div>
        )}
      </button>

      <span className="text-xs text-[var(--muted)] font-mono w-5 shrink-0 text-right">{index + 1}</span>

      <input
        type="text"
        value={track.title}
        onChange={(e) => onTitleChange(e.target.value)}
        onBlur={onTitleBlur}
        className="flex-1 min-w-0 text-sm bg-transparent border-b border-transparent focus:border-[var(--accent)] focus:outline-none transition-colors py-0.5"
      />

      {typeof track.duration === "number" && track.duration > 0 && (
        <span className="text-xs text-[var(--muted)] font-mono tabular-nums shrink-0">
          {formatTrimTime(track.duration)}
        </span>
      )}

      <div className="flex items-center gap-2 shrink-0">
        {(() => {
          // Radio tracks are live streams — they must stay as URLs, never get uploaded or trimmed.
          const isRadio = track.episodeGuid?.startsWith("radio-") ?? false;
          const isStreaming = !isRadio && !!track.trackUrl && !track.trackUrl.startsWith("yoto:#");
          const canTrim = !isRadio && !!track.sourceAudioUrl && !!onTrim;
          // Streaming tracks: one pill that opens the trim modal (modal also handles "no trim, just upload")
          // Already-uploaded tracks: separate Trim pill (re-trim & re-upload)
          if (isStreaming && canTrim) {
            return (
              <button
                onClick={onTrim}
                disabled={reuploading}
                title="Open the trim modal — set start/end (optional) then upload to Yoto"
                className="px-2 py-0.5 text-[10px] border border-[var(--accent-light)]/50 text-[var(--accent-light)] hover:bg-[var(--accent-light)]/10 disabled:opacity-60 disabled:cursor-default rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                {reuploading ? (
                  <>
                    <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                    Uploading…
                  </>
                ) : (
                  <>Trim &amp; Upload</>
                )}
              </button>
            );
          }
          if (isStreaming && !canTrim) {
            // Fallback if we somehow lost sourceAudioUrl: direct upload, no trim modal
            return (
              <button
                onClick={onReupload}
                disabled={reuploading}
                title="Upload to Yoto to enable scrubbing in the Yoto app"
                className="px-2 py-0.5 text-[10px] border border-[var(--accent-light)]/50 text-[var(--accent-light)] hover:bg-[var(--accent-light)]/10 disabled:opacity-60 disabled:cursor-default rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                {reuploading ? (
                  <>
                    <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                    Uploading…
                  </>
                ) : (
                  <>↑ Upload to Yoto</>
                )}
              </button>
            );
          }
          if (canTrim) {
            return (
              <button
                onClick={onTrim}
                disabled={reuploading}
                title="Trim intro, ads, or outro from this track"
                className="px-2 py-0.5 text-[10px] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--accent-light)] hover:border-[var(--accent-light)] disabled:opacity-60 disabled:cursor-default rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                {reuploading ? (
                  <>
                    <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                    Uploading…
                  </>
                ) : (track.trimStart || track.trimEnd) ? (
                  <>Trim · {track.trimStart ? formatTrimTime(track.trimStart) : "0:00"}–{track.trimEnd ? formatTrimTime(track.trimEnd) : "end"}</>
                ) : (
                  <>Trim</>
                )}
              </button>
            );
          }
          return null;
        })()}
        <button
          onClick={onPlay}
          disabled={!track.trackUrl}
          className="w-6 h-6 flex items-center justify-center text-[var(--muted)] hover:text-[var(--accent-light)] disabled:opacity-25 disabled:cursor-not-allowed transition-colors rounded text-[10px]"
          aria-label="Play"
        >
          ▶
        </button>
        <button
          onClick={onDelete}
          className="w-6 h-6 flex items-center justify-center text-[var(--muted)] hover:text-red-400 transition-colors rounded"
          aria-label="Remove track"
        >
          ×
        </button>
      </div>
    </motion.div>
  );
}

export function PlaylistEditor() {
  const {
    playlistTracks,
    editingCardId,
    selectedCard,
    podcast,
    episodes,
    setPlaylistTracks,
    removePlaylistTrack,
    setStep,
    setEpisodes,
    setIconSelections,
    setEditingTrackKey,
    setEditingAllTrackIcons,
    setPlayer,
    setEditingCardId,
    savedSnapshot,
    setSavedSnapshot,
  } = useAppStore();
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const [playlistTitle, setPlaylistTitle] = useState(
    selectedCard?.title ?? podcast?.title ?? "New Playlist"
  );
  const [playlistDescription, setPlaylistDescription] = useState(
    selectedCard?.description ?? (!editingCardId ? (podcast?.description ?? "") : "")
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [localTracks, setLocalTracks] = useState<PlaylistTrack[]>([]);
  const [coverMediaUrl, setCoverMediaUrl] = useState(selectedCard?.coverImage ?? "");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | undefined>(() => {
    const img = selectedCard?.coverImage;
    if (!img) return undefined;
    return img.startsWith("https://api.yotoplay.com/")
      ? `/api/yoto/media-proxy?url=${encodeURIComponent(img)}`
      : img;
  });
  const [coverUploading, setCoverUploading] = useState(false);
  const [showCoverMenu, setShowCoverMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [trimmingTrack, setTrimmingTrack] = useState<PlaylistTrack | null>(null);
  const [showCoverIconBrowser, setShowCoverIconBrowser] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showBatchRename, setShowBatchRename] = useState(false);
  const [renameFind, setRenameFind] = useState("");
  const [renameReplace, setRenameReplace] = useState("");
  const [renameRegexMode, setRenameRegexMode] = useState(false);
  const [uploadingKeys, setUploadingKeys] = useState<Set<string>>(new Set());
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalTracks(playlistTracks);
  }, [playlistTracks]);

  // Track changes against a "saved" snapshot so the Save button can disable
  // when nothing has changed and reset from "✓ Saved" once the user edits.
  // savedSnapshot is store-backed (see useAppStore) so it survives navigation
  // away to /tracks/new, /icons, etc. — otherwise the remount would re-baseline
  // it against the already-modified state and falsely report "no changes".
  function snapshotOf(tracks: PlaylistTrack[], title: string, desc: string, cover: string): string {
    return JSON.stringify({
      title,
      description: desc,
      cover,
      tracks: tracks.map((t) => ({
        key: t.key,
        title: t.title,
        trackUrl: t.trackUrl,
        iconRef: t.iconRef,
        trimStart: t.trimStart,
        trimEnd: t.trimEnd,
      })),
    });
  }
  const currentSnapshot = snapshotOf(localTracks, playlistTitle, playlistDescription, coverMediaUrl);
  useEffect(() => {
    if (savedSnapshot === null && localTracks.length > 0) {
      setSavedSnapshot(currentSnapshot);
    }
  }, [savedSnapshot, currentSnapshot, localTracks.length, setSavedSnapshot]);
  const isDirty = savedSnapshot !== null && savedSnapshot !== currentSnapshot;
  // Reset the green "✓ Saved!" state once the user edits again.
  useEffect(() => {
    if (isDirty && saveState === "done") setSaveState("idle");
  }, [isDirty, saveState]);

  // Auto-populate cover art from podcast artwork when creating a new playlist
  useEffect(() => {
    if (editingCardId || coverPreviewUrl || !podcast?.artworkUrl) return;
    const artworkUrl = podcast.artworkUrl;
    setCoverPreviewUrl(artworkUrl);
    setCoverUploading(true);
    fetch("/api/yoto/upload-cover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: artworkUrl, filename: "cover.jpg" }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(({ mediaUrl }) => { if (mediaUrl) { setCoverMediaUrl(mediaUrl); setCoverPreviewUrl(mediaUrl); } })
      .catch(() => { /* leave optimistic preview, skip ref */ })
      .finally(() => setCoverUploading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function updateTrackTitle(key: string, title: string) {
    setLocalTracks((prev) =>
      prev.map((t) => (t.key === key ? { ...t, title } : t))
    );
  }

  function commitTitles() {
    setPlaylistTracks(localTracks);
  }

  function moveTrack(index: number, direction: -1 | 1) {
    const next = [...localTracks];
    const swapIndex = index + direction;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    const renumbered = next.map((t, i) => ({ ...t, key: String(i + 1).padStart(2, "0") }));
    setLocalTracks(renumbered);
    setPlaylistTracks(renumbered);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setOverId(null);
  }

  function handleDragOver(event: DragOverEvent) {
    setOverId(event.over ? String(event.over.id) : null);
  }

  function handleDragCancel() {
    setActiveId(null);
    setOverId(null);
  }

  // Which index to draw the insert line after (-1 = before first item)
  const insertLineAfterIndex = (() => {
    if (!activeId || !overId || activeId === overId) return null;
    const activeIndex = localTracks.findIndex((t) => t.key === activeId);
    const overIndex = localTracks.findIndex((t) => t.key === overId);
    if (activeIndex === -1 || overIndex === -1) return null;
    return activeIndex < overIndex ? overIndex : overIndex - 1;
  })();

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOverId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localTracks.findIndex((t) => t.key === active.id);
    const newIndex = localTracks.findIndex((t) => t.key === over.id);
    const reordered = arrayMove(localTracks, oldIndex, newIndex).map((t, i) => ({
      ...t,
      key: String(i + 1).padStart(2, "0"),
    }));
    setLocalTracks(reordered);
    setPlaylistTracks(reordered);
  }

  function deleteTrack(key: string) {
    removePlaylistTrack(key);
    setLocalTracks((prev) => prev.filter((t) => t.key !== key));
  }

  async function handleDelete() {
    if (!editingCardId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/yoto/cards/${editingCardId}`, { method: "DELETE" });
      if (res.ok) router.push("/library");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleSave() {
    setSaveState("saving");
    setSaveError("");
    try {
      const url = editingCardId ? `/api/yoto/cards/${editingCardId}` : "/api/yoto/cards";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: playlistTitle,
          description: playlistDescription,
          ...(coverMediaUrl ? { coverMediaUrl } : {}),
          episodes: localTracks.map((t) => ({
            key: t.key,
            title: t.title,
            trackUrl: t.trackUrl,
            iconRef: t.iconRef,
            ...(t.duration !== undefined ? { duration: t.duration } : {}),
            ...(t.fileSize !== undefined ? { fileSize: t.fileSize } : {}),
            ...(t.channels ? { channels: t.channels } : {}),
            ...(t.format ? { format: t.format } : {}),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      // First-time CREATE returns a new cardId — promote it to editing state so
      // subsequent saves UPDATE the same card instead of creating duplicates.
      if (!editingCardId && typeof data.cardId === "string") setEditingCardId(data.cardId);
      setSavedSnapshot(currentSnapshot);
      setSaveState("done");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      setSaveState("error");
    }
  }

  async function handleCoverUpload(file: File) {
    setCoverUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setCoverPreviewUrl(dataUrl);
      const res = await fetch("/api/yoto/upload-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl, filename: file.name }),
      });
      if (res.ok) {
        const { mediaUrl } = await res.json();
        if (mediaUrl) setCoverMediaUrl(mediaUrl);
      }
    } catch { /* leave preview, skip ref */ } finally {
      setCoverUploading(false);
    }
  }

  async function handleCoverIconSelect(icon: YotoIcon) {
    setShowCoverIconBrowser(false);
    const preview = icon.previewDataUrl ?? icon.url;
    setCoverPreviewUrl(preview);
    setCoverUploading(true);
    try {
      const body = icon.previewDataUrl
        ? { imageDataUrl: icon.previewDataUrl, filename: `${icon.title}.png` }
        : { imageUrl: icon.url, filename: `${icon.title}.png` };
      const res = await fetch("/api/yoto/upload-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const { mediaUrl } = await res.json();
        if (mediaUrl) setCoverMediaUrl(mediaUrl);
      }
    } catch { /* leave optimistic preview */ } finally {
      setCoverUploading(false);
    }
  }

  function handleEditAllIcons() {
    setEpisodes(localTracks.map((track) => ({
      guid: track.key,
      title: track.title,
      description: "",
      pubDate: "",
      duration: "",
      audioUrl: track.trackUrl,
      selected: true,
    })));
    setIconSelections([]);
    setEditingAllTrackIcons(true);
    setStep("icons");
    if (editingCardId) {
      router.push(`/editor/${editingCardId}/icons`);
    } else {
      router.push("/create");
    }
  }

  function handleEditIcon(track: PlaylistTrack) {
    const initialSelections: IconSelection[] = [];
    if (track.iconPreviewUrl || track.iconRef) {
      const mediaId = track.iconRef?.startsWith("yoto:#") ? track.iconRef.slice(6) : null;
      const currentIcon: YotoIcon = {
        id: mediaId ?? `current-${track.key}`,
        source: mediaId ? "user-icon" : "custom",
        title: "Current icon",
        tags: [],
        url: track.iconPreviewUrl ?? "",
        previewDataUrl: track.iconPreviewUrl,
      };
      initialSelections.push({
        episodeGuid: track.key,
        candidates: [currentIcon],
        selectedIconId: currentIcon.id,
      });
    }
    setEpisodes([{
      guid: track.key,
      title: track.title,
      description: "",
      pubDate: "",
      duration: "",
      audioUrl: track.trackUrl,
      selected: true,
    }]);
    setIconSelections(initialSelections);
    setEditingTrackKey(track.key);
    setStep("icons");
    if (editingCardId) {
      router.push(`/editor/${editingCardId}/tracks/${track.key}/icon`);
    } else {
      router.push("/create");
    }
  }

  function sanitizeFilename(title: string): string {
    return title.replace(/[^\w\-. ]+/g, "_").slice(0, 100) || "episode";
  }

  async function uploadTrackToYoto(track: PlaylistTrack, opts?: { trimStart?: number; trimEnd?: number; sourceUrl?: string }): Promise<{ trackUrl: string; duration?: number; fileSize?: number; channels?: string; format?: string }> {
    const sourceUrl = opts?.sourceUrl ?? track.sourceAudioUrl ?? track.trackUrl;
    if (!sourceUrl) throw new Error("Track has no URL");
    const hasTrim = opts?.trimStart !== undefined || opts?.trimEnd !== undefined;
    if (!hasTrim && sourceUrl.includes("/api/audio/serve/")) {
      // Local blob — fetch then re-upload via FormData (existing path)
      const blobRes = await fetch(sourceUrl);
      if (!blobRes.ok) throw new Error("Could not fetch local audio");
      const blob = await blobRes.blob();
      const filename = sourceUrl.split("/").pop() ?? "audio.mp3";
      const formData = new FormData();
      formData.append("file", blob, filename);
      const uploadRes = await fetch("/api/audio/upload", { method: "POST", body: formData });
      const data = await uploadRes.json() as { trackUrl?: string; duration?: number; fileSize?: number; channels?: string; format?: string; error?: string };
      if (!uploadRes.ok || !data.trackUrl) throw new Error(data.error ?? "Upload failed");
      return { trackUrl: data.trackUrl, duration: data.duration, fileSize: data.fileSize, channels: data.channels, format: data.format };
    }
    // External URL (RSS feed etc.) — let the server fetch it (and optionally trim).
    // The route responds with a `text/event-stream` of progress events ending in
    // either `{stage:"done", trackUrl}` or `{stage:"failed", error}`.
    const uploadRes = await fetch("/api/podcasts/upload-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioUrl: sourceUrl,
        filename: `${sanitizeFilename(track.title)}.mp3`,
        ...(opts?.trimStart !== undefined ? { trimStart: opts.trimStart } : {}),
        ...(opts?.trimEnd !== undefined ? { trimEnd: opts.trimEnd } : {}),
      }),
    });

    // Non-streamed early errors (e.g. 401 before the SSE stream starts) come back as JSON.
    const contentType = uploadRes.headers.get("content-type") ?? "";
    if (!uploadRes.ok && contentType.includes("application/json")) {
      const data = await uploadRes.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? `Upload failed (${uploadRes.status})`);
    }
    if (!uploadRes.body) throw new Error("Upload stream missing");

    const reader = uploadRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let trackUrl: string | undefined;
    let duration: number | undefined;
    let fileSize: number | undefined;
    let channels: string | undefined;
    let format: string | undefined;
    let errMsg: string | undefined;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        let event;
        try { event = JSON.parse(dataLine.slice(6)); } catch { continue; }
        if (event.stage === "done") {
          trackUrl = event.trackUrl;
          if (typeof event.duration === "number" && event.duration > 0) duration = event.duration;
          if (event.transcode) {
            if (typeof event.transcode.fileSize === "number" && event.transcode.fileSize > 0) fileSize = event.transcode.fileSize;
            if (typeof event.transcode.channels === "string") channels = event.transcode.channels;
            if (typeof event.transcode.format === "string") format = event.transcode.format;
          }
        } else if (event.stage === "failed") errMsg = event.error;
      }
    }
    if (errMsg) throw new Error(errMsg);
    if (!trackUrl) throw new Error("Upload finished without a track URL");
    return { trackUrl, duration, fileSize, channels, format };
  }

  async function handleApplyTrim(track: PlaylistTrack, trimStart: number | undefined, trimEnd: number | undefined) {
    const sourceUrl = track.sourceAudioUrl;
    if (!sourceUrl) return;
    setTrimmingTrack(null);
    setUploadingKeys((prev) => new Set(prev).add(track.key));
    // Optimistically reflect new trim values in the UI
    const optimistic = localTracks.map((t) =>
      t.key === track.key ? { ...t, trimStart, trimEnd } : t
    );
    setLocalTracks(optimistic);
    setPlaylistTracks(optimistic);
    try {
      const result = await uploadTrackToYoto(
        { ...track, trimStart, trimEnd },
        { trimStart, trimEnd, sourceUrl }
      );
      const meta = transcodeMetaPatch(result);
      const updated = optimistic.map((t) =>
        t.key === track.key ? { ...t, trackUrl: result.trackUrl, ...meta } : t
      );
      setLocalTracks(updated);
      setPlaylistTracks(updated);
    } catch (err) {
      console.error("Trim/reupload failed:", err);
    } finally {
      setUploadingKeys((prev) => { const s = new Set(prev); s.delete(track.key); return s; });
    }
  }

  async function handleReuploadAll() {
    // Skip radio streams — they must stay as live URLs.
    const targets = localTracks.filter((t) => !!t.trackUrl && !t.trackUrl.startsWith("yoto:#") && !t.episodeGuid?.startsWith("radio-"));
    if (targets.length === 0) return;
    let current = [...localTracks];
    for (const track of targets) {
      setUploadingKeys((prev) => new Set(prev).add(track.key));
      try {
        const result = await uploadTrackToYoto(track);
        const meta = transcodeMetaPatch(result);
        current = current.map((t) => t.key === track.key ? { ...t, trackUrl: result.trackUrl, ...meta } : t);
        setLocalTracks(current);
        setPlaylistTracks(current);
      } catch (err) {
        console.error(`Reupload failed for ${track.title}:`, err);
      } finally {
        setUploadingKeys((prev) => { const s = new Set(prev); s.delete(track.key); return s; });
      }
    }
  }

  async function handleReupload(track: PlaylistTrack) {
    if (!track.trackUrl) return;
    setUploadingKeys((prev) => new Set(prev).add(track.key));
    try {
      const result = await uploadTrackToYoto(track);
      const meta = transcodeMetaPatch(result);
      const updated = localTracks.map((t) =>
        t.key === track.key ? { ...t, trackUrl: result.trackUrl, ...meta } : t
      );
      setLocalTracks(updated);
      setPlaylistTracks(updated);
    } catch (err) {
      console.error("Reupload failed:", err);
    } finally {
      setUploadingKeys((prev) => { const s = new Set(prev); s.delete(track.key); return s; });
    }
  }

  function buildRenameRegex(): RegExp | null {
    if (!renameFind) return null;
    try {
      const pattern = renameRegexMode
        ? renameFind
        : renameFind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(pattern, "g");
    } catch { return null; }
  }

  function sortTracks(mode: "date-asc" | "date-desc" | "title-asc" | "title-desc" | "reverse") {
    if (mode === "reverse") {
      const reversed = [...localTracks].reverse().map((t, i) => ({ ...t, key: String(i + 1).padStart(2, "0") }));
      setLocalTracks(reversed);
      setPlaylistTracks(reversed);
      return;
    }
    const pubDateByGuid = new Map(episodes.map((ep) => [ep.guid, ep.pubDate]));
    const sorted = [...localTracks].sort((a, b) => {
      if (mode === "title-asc") return a.title.localeCompare(b.title);
      if (mode === "title-desc") return b.title.localeCompare(a.title);
      const aDate = a.episodeGuid ? pubDateByGuid.get(a.episodeGuid) : undefined;
      const bDate = b.episodeGuid ? pubDateByGuid.get(b.episodeGuid) : undefined;
      const aTime = aDate ? new Date(aDate).getTime() : NaN;
      const bTime = bDate ? new Date(bDate).getTime() : NaN;
      const aMissing = !Number.isFinite(aTime);
      const bMissing = !Number.isFinite(bTime);
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      return mode === "date-asc" ? aTime - bTime : bTime - aTime;
    }).map((t, i) => ({ ...t, key: String(i + 1).padStart(2, "0") }));
    setLocalTracks(sorted);
    setPlaylistTracks(sorted);
  }

  const dateSortAvailable = localTracks.some(
    (t) => t.episodeGuid && episodes.some((ep) => ep.guid === t.episodeGuid && ep.pubDate)
  );

  function applyBatchRename() {
    const regex = buildRenameRegex();
    if (!regex) return;
    const renamed = localTracks.map((t) => ({ ...t, title: t.title.replace(regex, renameReplace) }));
    setLocalTracks(renamed);
    setPlaylistTracks(renamed);
    setShowBatchRename(false);
    setRenameFind("");
    setRenameReplace("");
  }

  function resolveIconSrc(track: PlaylistTrack): string | null {
    if (track.iconPreviewUrl) return track.iconPreviewUrl;
    if (track.iconRef.startsWith("http")) return track.iconRef;
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Cover image */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowCoverMenu((v) => !v)}
              className="w-20 aspect-[2/3] rounded-lg overflow-hidden border border-[var(--border)] hover:border-[var(--accent-light)] transition-colors cursor-pointer block"
              title="Change cover"
            >
              {coverUploading ? (
                <div className="w-full h-full bg-[var(--card)] flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : coverPreviewUrl ? (
                <img src={coverPreviewUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[var(--card)] flex items-center justify-center">
                  <span className="text-[var(--muted)] text-lg">▤</span>
                </div>
              )}
            </button>
            {showCoverMenu && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                <button
                  type="button"
                  onClick={() => { setShowCoverMenu(false); coverFileInputRef.current?.click(); }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--card)] transition-colors"
                >
                  Upload image
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCoverMenu(false); setShowCoverIconBrowser(true); }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--card)] transition-colors"
                >
                  Browse icons
                </button>
              </div>
            )}
            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={coverUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCoverUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <input
              type="text"
              value={playlistTitle}
              onChange={(e) => setPlaylistTitle(e.target.value)}
              className="w-full text-xl font-semibold bg-transparent border-b border-transparent focus:border-[var(--accent)] focus:outline-none transition-colors pb-0.5 truncate"
            />
            <textarea
              value={playlistDescription}
              onChange={(e) => setPlaylistDescription(e.target.value)}
              placeholder="Add a description…"
              rows={1}
              className="w-full text-sm text-[var(--muted)] bg-transparent resize-none overflow-hidden border-b border-transparent focus:border-[var(--accent)] focus:outline-none focus:text-[var(--foreground)] transition-colors placeholder:text-[var(--muted)]/50 [field-sizing:content]"
            />
            <p className="text-xs text-[var(--muted)]">
              {localTracks.length} track{localTracks.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (editingCardId) router.push("/library");
            else setStep("icons");
          }}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors shrink-0 mt-1"
        >
          ← Back
        </button>
      </div>

      {(() => {
        // Radio streams are excluded — they must stay as URLs.
        const streamingCount = localTracks.filter((t) => !!t.trackUrl && !t.trackUrl.startsWith("yoto:#") && !t.episodeGuid?.startsWith("radio-")).length;
        if (streamingCount === 0) return null;
        return (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[var(--accent-light)]/5 border border-[var(--accent-light)]/30 rounded-lg">
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm text-[var(--muted)]">
                {streamingCount} track{streamingCount !== 1 ? "s" : ""} can be uploaded to Yoto to enable scrubbing.
              </p>
              <p className="text-xs text-[var(--muted)]/70">
                Worth it for tracks longer than a couple of minutes — short tracks may not need scrubbing feature.
              </p>
            </div>
            <button
              onClick={handleReuploadAll}
              disabled={uploadingKeys.size > 0}
              className="shrink-0 px-3 py-1 text-xs border border-[var(--accent-light)]/50 text-[var(--accent-light)] hover:bg-[var(--accent-light)]/10 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {uploadingKeys.size > 0 ? `Uploading ${uploadingKeys.size}…` : "Upload all to Yoto"}
            </button>
          </div>
        );
      })()}

      {saveState === "done" && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-400">Saved to Yoto! Check your app.</p>
          <button
            onClick={() => router.push("/library")}
            className="px-3 py-1 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors shrink-0"
          >
            Done
          </button>
        </div>
      )}

      {saveState === "error" && saveError && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {saveError}
        </div>
      )}

      {localTracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <p className="text-sm text-[var(--muted)]">No tracks yet</p>
          <button
            onClick={() => {
              setStep("search");
              if (editingCardId) router.push(`/editor/${editingCardId}/tracks/new`);
              else router.push("/create");
            }}
            className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent-light)] rounded-lg transition-colors"
          >
            Add tracks
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
          <SortableContext items={localTracks.map((t) => t.key)} strategy={verticalListSortingStrategy}>
            <LayoutGroup>
            <div className="space-y-1">
              {insertLineAfterIndex === -1 && (
                <div className="h-0.5 rounded-full bg-[var(--accent)] mx-1" />
              )}
              {localTracks.map((track, index) => (
                <div key={track.episodeGuid || track.trackUrl || track.key}>
                  <SortableTrackRow
                    track={track}
                    index={index}
                    iconSrc={resolveIconSrc(track)}
                    onEditIcon={() => handleEditIcon(track)}
                    onDelete={() => deleteTrack(track.key)}
                    onPlay={() => {
                      let url = track.trackUrl;
                      if (track.trackUrl?.startsWith("yoto:#")) {
                        const params = new URLSearchParams({ ref: track.trackUrl });
                        if (editingCardId) params.set("cardId", editingCardId);
                        url = `/api/podcasts/audio?${params.toString()}`;
                      }
                      setPlayer(url, track.title);
                    }}
                    onTitleChange={(v) => updateTrackTitle(track.key, v)}
                    onTitleBlur={commitTitles}
                    onReupload={() => handleReupload(track)}
                    onTrim={track.sourceAudioUrl ? () => setTrimmingTrack(track) : undefined}
                    reuploading={uploadingKeys.has(track.key)}
                  />
                  {insertLineAfterIndex === index && (
                    <div className="h-0.5 rounded-full bg-[var(--accent)] mx-1 mt-1" />
                  )}
                </div>
              ))}
            </div>
            </LayoutGroup>
          </SortableContext>
          <DragOverlay>
            {activeId ? (() => {
              const t = localTracks.find((t) => t.key === activeId);
              if (!t) return null;
              const src = resolveIconSrc(t);
              return (
                <div className="flex items-center gap-2 p-3 bg-[var(--card)] border border-[var(--accent)]/60 rounded-lg shadow-xl shadow-black/40 opacity-95">
                  <span className="shrink-0 flex flex-col gap-[3px] items-center px-0.5">
                    <span className="w-3 h-px bg-[var(--muted)] block" />
                    <span className="w-3 h-px bg-[var(--muted)] block" />
                    <span className="w-3 h-px bg-[var(--muted)] block" />
                  </span>
                  <div className="w-7 h-7 rounded shrink-0 overflow-hidden" style={{ imageRendering: "pixelated" }}>
                    {src ? (
                      <img src={src} alt="" width={28} height={28} className="w-full h-full object-cover" style={{ imageRendering: "pixelated" }} />
                    ) : (
                      <div className="w-full h-full bg-[var(--accent)]/20 rounded" />
                    )}
                  </div>
                  <span className="text-sm font-medium truncate flex-1">{t.title}</span>
                </div>
              );
            })() : null}
          </DragOverlay>
        </DndContext>
      )}

      {showBatchRename && (() => {
        const regex = buildRenameRegex();
        const regexError = renameRegexMode && !!renameFind && !regex;
        const previews = regex
          ? localTracks.map((t) => ({ key: t.key, before: t.title, after: t.title.replace(regex, renameReplace) })).filter((p) => p.before !== p.after)
          : [];
        return (
          <div className="border border-[var(--border)] rounded-xl p-4 space-y-3 bg-[var(--card)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Batch rename</p>
              <button
                onClick={() => setRenameRegexMode((v) => !v)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors font-mono ${renameRegexMode ? "border-[var(--accent)] text-[var(--accent-light)] bg-[var(--accent)]/10" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent-light)]/50"}`}
              >
                .*  regex
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-[var(--muted)]">Find</label>
                <input
                  value={renameFind}
                  onChange={(e) => setRenameFind(e.target.value)}
                  placeholder={renameRegexMode ? "e.g. ^\\d+-\\d+ \\| " : "e.g. Old Bear Stories - "}
                  className={`w-full px-3 py-1.5 text-sm font-mono bg-[var(--background)] border rounded-lg focus:outline-none transition-colors ${regexError ? "border-red-400" : "border-[var(--border)] focus:border-[var(--accent)]"}`}
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-[var(--muted)]">Replace with</label>
                <input
                  value={renameReplace}
                  onChange={(e) => setRenameReplace(e.target.value)}
                  placeholder="leave empty to delete"
                  className="w-full px-3 py-1.5 text-sm font-mono bg-[var(--background)] border border-[var(--border)] focus:border-[var(--accent)] rounded-lg focus:outline-none transition-colors"
                />
              </div>
            </div>
            {regexError && <p className="text-xs text-red-400">Invalid regex</p>}
            {regex && previews.length === 0 && !regexError && (
              <p className="text-xs text-[var(--muted)]">No tracks match</p>
            )}
            {previews.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {previews.map((p) => (
                  <div key={p.key} className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--muted)] line-through truncate flex-1">{p.before}</span>
                    <span className="text-[var(--muted)] shrink-0">→</span>
                    {p.after ? (
                      <span className="text-[var(--foreground)] truncate flex-1">{p.after}</span>
                    ) : (
                      <span className="text-red-400/70 italic flex-1">(empty)</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowBatchRename(false); setRenameFind(""); setRenameReplace(""); }} className="px-3 py-1.5 text-xs border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={applyBatchRename} disabled={!renameFind || regexError || previews.length === 0} className="px-3 py-1.5 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-lg transition-colors">
                Apply to {previews.length} track{previews.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        );
      })()}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
        <div className="flex items-center gap-2">
          {localTracks.length > 1 && (
            <div className="relative">
              <select
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) sortTracks(v as "date-asc" | "date-desc" | "title-asc" | "title-desc" | "reverse");
                  e.target.value = "";
                }}
                className="appearance-none pl-4 pr-9 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent-light)] rounded-lg transition-colors bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="">Sort…</option>
                <option value="date-asc" disabled={!dateSortAvailable}>Oldest first</option>
                <option value="date-desc" disabled={!dateSortAvailable}>Newest first</option>
                <option value="title-asc">Title A–Z</option>
                <option value="title-desc">Title Z–A</option>
                <option value="reverse">Reverse</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">▼</span>
            </div>
          )}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              className="pl-4 pr-9 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent-light)] rounded-lg transition-colors relative"
            >
              More
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">▼</span>
            </button>
            {showMoreMenu && (
              <div className="absolute bottom-full mb-1 left-0 z-20 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden min-w-[180px]">
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setStep("search");
                    if (editingCardId) router.push(`/editor/${editingCardId}/tracks/new`);
                    else router.push("/create");
                  }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--card)] transition-colors"
                >
                  Add more tracks
                </button>
                {localTracks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setShowMoreMenu(false); handleEditAllIcons(); }}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--card)] transition-colors"
                  >
                    Edit all track icons
                  </button>
                )}
                {localTracks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setShowMoreMenu(false); setShowBatchRename(true); }}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--card)] transition-colors"
                  >
                    Batch rename
                  </button>
                )}
                {editingCardId && (
                  <>
                    <div className="border-t border-[var(--border)]" />
                    <button
                      type="button"
                      onClick={() => { setShowMoreMenu(false); setConfirmDelete(true); }}
                      className="w-full px-3 py-2 text-xs text-left text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Delete playlist
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saveState === "saving" || localTracks.length === 0 || (!!editingCardId && !isDirty)}
          title={editingCardId && !isDirty ? "No changes to save" : undefined}
          className={`flex items-center gap-2 px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-300 ${
            saveState === "done"
              ? "bg-green-500 hover:bg-green-600 scale-105"
              : "bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
          }`}
        >
          {saveState === "saving" && (
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          )}
          {saveState === "done" ? "✓ Saved!" : isDirty ? "Save changes" : "Save to Yoto"}
        </button>
      </div>

      {showCoverIconBrowser && (
        <IconBrowserModal
          onSelect={handleCoverIconSelect}
          onClose={() => setShowCoverIconBrowser(false)}
        />
      )}

      {trimmingTrack && (
        <TrimModal
          track={trimmingTrack}
          onApply={(start, end) => handleApplyTrim(trimmingTrack, start, end)}
          onClose={() => setTrimmingTrack(null)}
        />
      )}

      {showCoverMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowCoverMenu(false)} />
      )}

      {showMoreMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(false); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-sm bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-2xl p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="font-medium">Delete playlist?</h3>
              <p className="text-sm text-[var(--muted)]">
                <span className="text-[var(--foreground)]">{playlistTitle}</span> will be permanently removed from your Yoto library. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
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
