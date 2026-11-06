"use client";

import { useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Episode, PlaylistTrack } from "@/types";
import { TrackScrubber, pillBtnClass, type TrackScrubberHandle } from "@/components/TrackScrubber";

type AudioUploadStatus = "queued" | "uploading" | "done" | "failed";

function parseMmSs(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => Number.isNaN(n) || n < 0)) return null;
  if (nums.length === 1) return nums[0];
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  return nums[0] * 3600 + nums[1] * 60 + nums[2];
}

function formatMmSs(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^\w\-. ]+/g, "_").slice(0, 100) || "episode";
}

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

interface TrimEntry {
  startInput: string;
  endInput: string;
}

export function ReviewStep() {
  const { episodes, resolvedIconsByGuid, playlistTracks, setPlaylistTracks, setStep, toggleEpisode } = useAppStore();
  const selectedEpisodes = useMemo(() => episodes.filter((ep) => ep.selected), [episodes]);

  const [trim, setTrim] = useState<Record<string, TrimEntry>>(() => {
    const init: Record<string, TrimEntry> = {};
    for (const ep of selectedEpisodes) init[ep.guid] = { startInput: "", endInput: "" };
    return init;
  });

  const [durations, setDurations] = useState<Record<string, number>>({});
  const [bulkSkipFirst, setBulkSkipFirst] = useState("");
  const [bulkSkipLast, setBulkSkipLast] = useState("");
  const [bulkExpanded, setBulkExpanded] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ guid: string; title: string } | null>(null);
  const [audioStatus, setAudioStatus] = useState<Record<string, AudioUploadStatus>>({});
  const [audioErrors, setAudioErrors] = useState<Record<string, string>>({});
  const [audioStage, setAudioStage] = useState<Record<string, { message: string; progress: number }>>({});
  const [silencesByGuid, setSilencesByGuid] = useState<Record<string, Array<{ start: number; end: number }>>>({});
  const [silenceConfigByGuid, setSilenceConfigByGuid] = useState<Record<string, { noiseDb: number; minDurationSec: number }>>({});
  const silenceFetchedRef = useRef<Set<string>>(new Set());

  function fetchSilences(guid: string, audioUrl: string, config: { noiseDb: number; minDurationSec: number }) {
    const params = new URLSearchParams({
      url: audioUrl,
      noise: String(config.noiseDb),
      dur: String(config.minDurationSec),
    });
    fetch(`/api/podcasts/silence?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.silences)) {
          setSilencesByGuid((prev) => ({ ...prev, [guid]: data.silences }));
        }
      })
      .catch(() => { /* non-fatal */ });
  }
  const [uploadCount, setUploadCount] = useState({ done: 0, total: 0 });
  const [needsDecision, setNeedsDecision] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const trackUrlsRef = useRef<Record<string, string>>({});
  const trackDurationsRef = useRef<Record<string, number>>({});
  const trackTranscodeRef = useRef<Record<string, { fileSize?: number; channels?: string; format?: string }>>({});
  const scrubberRefs = useRef<Record<string, TrackScrubberHandle | null>>({});

  function setEntry(guid: string, patch: Partial<TrimEntry>) {
    setTrim((prev) => ({ ...prev, [guid]: { ...prev[guid], ...patch } }));
  }

  const bulkSkipFirstSec = parseMmSs(bulkSkipFirst);
  const bulkSkipLastSec = parseMmSs(bulkSkipLast);
  const bulkSkipFirstInvalid = bulkSkipFirst.trim() !== "" && bulkSkipFirstSec === null;
  const bulkSkipLastInvalid = bulkSkipLast.trim() !== "" && bulkSkipLastSec === null;

  // Effective trim per episode = manual override if set, else bulk value
  function getEffectiveTrim(guid: string): { start?: number; end?: number; valid: boolean } {
    const entry = trim[guid];
    const dur = durations[guid] ?? 0;
    const manualStart = entry?.startInput ? parseMmSs(entry.startInput) : null;
    const manualEnd = entry?.endInput ? parseMmSs(entry.endInput) : null;
    const startInvalid = !!entry?.startInput && manualStart === null;
    const endInvalid = !!entry?.endInput && manualEnd === null;

    let start: number | undefined;
    if (manualStart !== null && manualStart > 0) start = manualStart;
    else if ((bulkSkipFirstSec ?? 0) > 0) start = bulkSkipFirstSec!;

    let end: number | undefined;
    if (manualEnd !== null && manualEnd > 0) end = manualEnd;
    else if ((bulkSkipLastSec ?? 0) > 0 && dur > 0) end = Math.max(0, dur - bulkSkipLastSec!);

    const orderInvalid = start !== undefined && end !== undefined && start >= end;
    return { start, end, valid: !startInvalid && !endInvalid && !orderInvalid };
  }

  const allValid = selectedEpisodes.every((ep) => getEffectiveTrim(ep.guid).valid);

  async function uploadOne(ep: Episode): Promise<boolean> {
    setAudioStatus((prev) => ({ ...prev, [ep.guid]: "uploading" }));
    setAudioStage((prev) => ({ ...prev, [ep.guid]: { message: "Starting…", progress: 0 } }));
    try {
      const { start, end } = getEffectiveTrim(ep.guid);
      const res = await fetch("/api/podcasts/upload-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioUrl: ep.audioUrl,
          filename: `${sanitizeFilename(ep.title)}.mp3`,
          ...(start !== undefined ? { trimStart: start } : {}),
          ...(end !== undefined ? { trimEnd: end } : {}),
        }),
      });

      // Non-streamed error (e.g. 401 before stream starts)
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok && contentType.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      if (!res.body) throw new Error("Upload stream missing");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let trackUrl: string | undefined;
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
            if (typeof event.duration === "number" && event.duration > 0) {
              trackDurationsRef.current[ep.guid] = event.duration;
            }
            if (event.transcode) {
              trackTranscodeRef.current[ep.guid] = {
                fileSize: typeof event.transcode.fileSize === "number" ? event.transcode.fileSize : undefined,
                channels: typeof event.transcode.channels === "string" ? event.transcode.channels : undefined,
                format: typeof event.transcode.format === "string" ? event.transcode.format : undefined,
              };
            }
          } else if (event.stage === "failed") {
            errMsg = event.error;
          } else {
            setAudioStage((prev) => ({ ...prev, [ep.guid]: { message: event.message, progress: event.progress } }));
          }
        }
      }

      if (errMsg) throw new Error(errMsg);
      if (!trackUrl) throw new Error("Upload finished without a track URL");

      trackUrlsRef.current[ep.guid] = trackUrl;
      setAudioStatus((prev) => ({ ...prev, [ep.guid]: "done" }));
      setAudioStage((prev) => ({ ...prev, [ep.guid]: { message: "Done", progress: 100 } }));
      setAudioErrors((prev) => { const next = { ...prev }; delete next[ep.guid]; return next; });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setAudioStatus((prev) => ({ ...prev, [ep.guid]: "failed" }));
      setAudioErrors((prev) => ({ ...prev, [ep.guid]: message }));
      return false;
    }
  }

  async function uploadOneFromButton(ep: Episode) {
    if (audioStatus[ep.guid] === "uploading" || audioStatus[ep.guid] === "done") return;
    if (!getEffectiveTrim(ep.guid).valid) return;
    await uploadOne(ep);
  }

  async function downloadTrim(ep: Episode) {
    const { start, end, valid } = getEffectiveTrim(ep.guid);
    if (!valid) return;
    const filename = `${sanitizeFilename(ep.title)}-trimmed.mp3`;
    try {
      const res = await fetch("/api/podcasts/trim-only", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioUrl: ep.audioUrl,
          filename,
          ...(start !== undefined ? { trimStart: start } : {}),
          ...(end !== undefined ? { trimEnd: end } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Trim failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download trim failed:", err);
      setAudioErrors((prev) => ({ ...prev, [ep.guid]: err instanceof Error ? err.message : "Download failed" }));
    }
  }

  async function runUploadPool(targets: Episode[]): Promise<{ failureCount: number }> {
    // Skip already-done episodes; only process pending or failed.
    const pending = targets.filter((ep) => audioStatus[ep.guid] !== "done" && audioStatus[ep.guid] !== "uploading");
    setUploadCount({ done: 0, total: pending.length });
    setAudioStatus((prev) => {
      const next = { ...prev };
      for (const ep of pending) next[ep.guid] = "queued";
      return next;
    });

    let completed = 0;
    let failures = 0;
    const queue = [...pending];

    const worker = async () => {
      while (queue.length > 0) {
        const ep = queue.shift();
        if (!ep) return;
        const ok = await uploadOne(ep);
        if (!ok) failures++;
        completed++;
        setUploadCount({ done: completed, total: pending.length });
      }
    };

    await Promise.all([worker(), worker()]);
    return { failureCount: failures };
  }

  function finalizePlaylist() {
    const updatedTracks = [...playlistTracks];
    const newTracks: PlaylistTrack[] = [];

    for (const ep of selectedEpisodes) {
      const { start, end } = getEffectiveTrim(ep.guid);
      const trackUrl = trackUrlsRef.current[ep.guid] ?? ep.audioUrl;
      const r = resolvedIconsByGuid[ep.guid] ?? { iconRef: "" };

      // Prefer the server-side ffprobe duration of the actual uploaded bytes (most accurate
      // — reflects the real trimmed file). Fall back to scrubber metadata, then RSS string.
      const uploadedDur = trackDurationsRef.current[ep.guid];
      const metadataDur = durations[ep.guid];
      const rssDur = parseRssDuration(ep.duration);
      const trimmedDur = (metadataDur ?? rssDur) !== undefined
        ? Math.max(0, (end ?? metadataDur ?? rssDur ?? 0) - (start ?? 0))
        : undefined;

      const existingIndex = updatedTracks.findIndex((t) => t.episodeGuid === ep.guid);
      const transcode = trackTranscodeRef.current[ep.guid];
      const base = {
        title: ep.title,
        trackUrl,
        iconRef: r.iconRef,
        iconPreviewUrl: r.iconPreviewUrl,
        sourceAudioUrl: ep.audioUrl,
        trimStart: start,
        trimEnd: end,
        duration: uploadedDur ?? (trimmedDur && trimmedDur > 0 ? trimmedDur : (metadataDur ?? rssDur)),
        ...(transcode?.fileSize !== undefined ? { fileSize: transcode.fileSize } : {}),
        ...(transcode?.channels ? { channels: transcode.channels } : {}),
        ...(transcode?.format ? { format: transcode.format } : {}),
      };
      if (existingIndex >= 0) {
        updatedTracks[existingIndex] = { ...updatedTracks[existingIndex], ...base };
      } else {
        newTracks.push({ key: "", episodeGuid: ep.guid, ...base });
      }
    }

    const combined = [
      ...updatedTracks,
      ...newTracks.map((t, i) => ({ ...t, key: String(updatedTracks.length + i + 1).padStart(2, "0") })),
    ];
    setPlaylistTracks(combined);
    setStep("editor");
  }

  async function handleUploadAll() {
    if (!allValid) return;
    // If everything is already done, skip the pool and just finalize.
    const allDone = selectedEpisodes.every((ep) => audioStatus[ep.guid] === "done");
    if (allDone) {
      finalizePlaylist();
      return;
    }
    setIsUploading(true);
    setError("");
    setNeedsDecision(false);
    try {
      const { failureCount } = await runUploadPool(selectedEpisodes);
      if (failureCount === 0) finalizePlaylist();
      else setNeedsDecision(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRetryFailed() {
    setIsUploading(true);
    setNeedsDecision(false);
    try {
      const failedGuids = Object.entries(audioStatus).filter(([, s]) => s === "failed").map(([g]) => g);
      const targets = selectedEpisodes.filter((ep) => failedGuids.includes(ep.guid));
      if (targets.length === 0) return;
      const { failureCount } = await runUploadPool(targets);
      if (failureCount === 0) finalizePlaylist();
      else setNeedsDecision(true);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Review &amp; trim</h2>
          <p className="text-sm text-[var(--muted)]">
            Optionally trim intros, ads, or outros before uploading {selectedEpisodes.length} episode{selectedEpisodes.length !== 1 ? "s" : ""} to Yoto.
          </p>
        </div>
        <button
          onClick={() => setStep("icons")}
          disabled={isUploading}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50 transition-colors"
        >
          ← Back
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {needsDecision && (() => {
        const failedEpisodes = selectedEpisodes.filter((ep) => audioStatus[ep.guid] === "failed");
        return (
          <div className="px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg space-y-2">
            <p className="text-sm">
              {failedEpisodes.length} episode{failedEpisodes.length !== 1 ? "s" : ""} couldn&apos;t be uploaded. They&apos;ll stream (no scrubbing) if you continue.
            </p>
            <ul className="text-xs text-[var(--muted)] space-y-0.5 list-disc list-inside">
              {failedEpisodes.map((ep) => (
                <li key={ep.guid} className="truncate">
                  {ep.title}
                  {audioErrors[ep.guid] && <span> — {audioErrors[ep.guid]}</span>}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleRetryFailed}
                disabled={isUploading}
                className="px-3 py-1.5 text-xs border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent-light)] disabled:opacity-50 rounded-lg transition-colors"
              >
                Retry failed
              </button>
              <button
                onClick={finalizePlaylist}
                disabled={isUploading}
                className="px-3 py-1.5 text-xs border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50 rounded-lg transition-colors"
              >
                Add anyway
              </button>
            </div>
          </div>
        );
      })()}

      {selectedEpisodes.length > 1 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg">
          <button
            type="button"
            onClick={() => setBulkExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-[var(--card-hover)] transition-colors rounded-lg"
          >
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Trim all episodes</p>
              {(bulkSkipFirstSec ?? 0) > 0 || (bulkSkipLastSec ?? 0) > 0 ? (
                <p className="text-[10px] text-[var(--accent-light)]">
                  Active · {(bulkSkipFirstSec ?? 0) > 0 && `cut ${formatMmSs(bulkSkipFirstSec!)} from start`}{(bulkSkipFirstSec ?? 0) > 0 && (bulkSkipLastSec ?? 0) > 0 && " · "}{(bulkSkipLastSec ?? 0) > 0 && `cut ${formatMmSs(bulkSkipLastSec!)} from end`}
                </p>
              ) : (
                <p className="text-[10px] text-[var(--muted)]">Cut the same intro/outro length off every track</p>
              )}
            </div>
            <span className="text-[10px] text-[var(--muted)] shrink-0">{bulkExpanded ? "▲" : "▼"}</span>
          </button>
          {bulkExpanded && (
            <div className="px-3 pb-3 pt-1 border-t border-[var(--border)]">
              <p className="text-[10px] text-[var(--muted)] mb-2">Click an input then use ↑/↓ to nudge by 1s, Shift+↑/↓ for 10s.</p>
              <div className="grid grid-cols-2 gap-2">
                <PrecisionInput
                  label="Cut from start"
                  value={bulkSkipFirst}
                  onChange={setBulkSkipFirst}
                  placeholder="e.g. 1:30"
                  invalid={bulkSkipFirstInvalid}
                  disabled={isUploading}
                  drivable
                />
                <PrecisionInput
                  label="Cut from end"
                  value={bulkSkipLast}
                  onChange={setBulkSkipLast}
                  placeholder="e.g. 0:30"
                  invalid={bulkSkipLastInvalid}
                  disabled={isUploading}
                  drivable
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {selectedEpisodes.map((ep) => {
          const r = resolvedIconsByGuid[ep.guid];
          const entry = trim[ep.guid] ?? { startInput: "", endInput: "" };
          const status = audioStatus[ep.guid];
          const { start, end, valid } = getEffectiveTrim(ep.guid);
          const trimLabel = (start !== undefined || end !== undefined)
            ? `${start ? formatMmSs(start) : "0:00"}–${end ? formatMmSs(end) : "end"}`
            : null;

          const isDone = status === "done";
          const isUploadingTrack = status === "uploading";

          return (
            <div key={ep.guid} className="bg-[var(--card)] border border-[var(--border)] rounded-lg">
              <div className="flex items-center gap-3 p-3">
                <div className="w-8 h-8 rounded shrink-0 overflow-hidden bg-[var(--background)]" style={{ imageRendering: "pixelated" }}>
                  {r?.iconPreviewUrl && (
                    <img src={r.iconPreviewUrl} alt="" width={32} height={32} className="w-full h-full object-cover" style={{ imageRendering: "pixelated" }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ep.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 min-h-[14px]">
                    <span className={`text-[10px] ${trimLabel ? "text-[var(--accent-light)]" : "text-transparent select-none"}`}>
                      {trimLabel ? `Trim · ${trimLabel}` : "—"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmRemove({ guid: ep.guid, title: ep.title })}
                  disabled={isUploading || isUploadingTrack}
                  className="w-6 h-6 flex items-center justify-center text-[var(--muted)] hover:text-red-400 disabled:opacity-30 disabled:cursor-default transition-colors rounded text-base leading-none"
                  aria-label="Remove episode"
                  title={isUploadingTrack ? "Cannot remove while uploading" : "Remove this episode"}
                >
                  ×
                </button>
              </div>

              <div className="px-3 pb-3 space-y-3 border-t border-[var(--border)] pt-3">
                  <TrackScrubber
                    ref={(el) => { scrubberRefs.current[ep.guid] = el; }}
                    src={`/api/podcasts/audio?url=${encodeURIComponent(ep.audioUrl)}`}
                    trimStart={start}
                    trimEnd={end}
                    silences={silencesByGuid[ep.guid]}
                    disabled={isUploading}
                    onDurationChange={(d) => {
                      setDurations((prev) => prev[ep.guid] === d ? prev : { ...prev, [ep.guid]: d });
                      // Once duration is known the audio is cached server-side — kick off silence detection.
                      if (!silenceFetchedRef.current.has(ep.guid)) {
                        silenceFetchedRef.current.add(ep.guid);
                        fetch(`/api/podcasts/silence?url=${encodeURIComponent(ep.audioUrl)}`)
                          .then((r) => r.json())
                          .then((data) => {
                            if (Array.isArray(data?.silences)) {
                              setSilencesByGuid((prev) => ({ ...prev, [ep.guid]: data.silences }));
                            }
                          })
                          .catch(() => { /* non-fatal — silence overlay just won't appear */ });
                      }
                    }}
                    onTrimChange={(s, e) => setEntry(ep.guid, {
                      startInput: s !== undefined && s > 0 ? formatMmSs(s) : "",
                      endInput: e !== undefined ? formatMmSs(e) : "",
                    })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <PrecisionInput
                      label="Start"
                      value={entry.startInput}
                      onChange={(v) => setEntry(ep.guid, { startInput: v })}
                      onUsePlayhead={() => {
                        const t = scrubberRefs.current[ep.guid]?.getCurrentTime() ?? 0;
                        setEntry(ep.guid, { startInput: formatMmSs(t) });
                      }}
                      placeholder="from beginning"
                      invalid={!!entry.startInput.trim() && parseMmSs(entry.startInput) === null}
                      disabled={isUploading}
                    />
                    <PrecisionInput
                      label="End"
                      value={entry.endInput}
                      onChange={(v) => setEntry(ep.guid, { endInput: v })}
                      onUsePlayhead={() => {
                        const t = scrubberRefs.current[ep.guid]?.getCurrentTime() ?? 0;
                        setEntry(ep.guid, { endInput: formatMmSs(t) });
                      }}
                      placeholder="to end"
                      invalid={!!entry.endInput.trim() && parseMmSs(entry.endInput) === null}
                      disabled={isUploading}
                    />
                  </div>
                {!valid && (
                  <p className="text-xs text-red-400">Invalid trim values — start must be before end.</p>
                )}
                <div className="flex items-end justify-between gap-3 pt-1">
                  <div className="flex-1 min-w-0">
                    {status === "queued" && (
                      <p className="text-xs text-[var(--muted)]">Queued for upload…</p>
                    )}
                    {isUploadingTrack && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-purple-400 truncate">{audioStage[ep.guid]?.message ?? "Uploading…"}</span>
                          <span className="text-[var(--muted)] font-mono tabular-nums shrink-0">{Math.round(audioStage[ep.guid]?.progress ?? 0)}%</span>
                        </div>
                        <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 transition-all duration-300 rounded-full"
                            style={{ width: `${audioStage[ep.guid]?.progress ?? 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {status === "done" && (
                      <p className="text-xs text-green-400">Uploaded to Yoto ✓</p>
                    )}
                    {status === "failed" && audioErrors[ep.guid] && (
                      <p className="text-xs text-amber-400">Failed: {audioErrors[ep.guid]}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadTrim(ep)}
                      disabled={isUploading || isUploadingTrack || !valid}
                      className={pillBtnClass}
                      title="Download the trimmed mp3 to inspect locally (no upload to Yoto)"
                    >
                      ↓ Download trim
                    </button>
                    <button
                      type="button"
                      onClick={() => uploadOneFromButton(ep)}
                      disabled={isUploading || isUploadingTrack || isDone || !valid}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                        isDone
                          ? "bg-green-500/15 text-green-400 cursor-default"
                          : "bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white"
                      }`}
                      title={
                        isDone ? "Already uploaded"
                        : isUploadingTrack ? "Uploading…"
                        : !valid ? "Fix trim values to upload"
                        : "Upload this track now"
                      }
                    >
                      {isUploadingTrack && (
                        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      )}
                      {isDone ? "✓ Uploaded" : isUploadingTrack ? "Uploading…" : status === "failed" ? "Retry upload" : "Upload to Yoto"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
        <p className="text-sm text-[var(--muted)]">
          {isUploading && uploadCount.total > 0
            ? `Uploading ${Math.min(uploadCount.done + 1, uploadCount.total)}/${uploadCount.total}…`
            : (() => {
                const doneCount = selectedEpisodes.filter((ep) => audioStatus[ep.guid] === "done").length;
                if (doneCount === 0) return `${selectedEpisodes.length} episode${selectedEpisodes.length !== 1 ? "s" : ""} ready`;
                if (doneCount === selectedEpisodes.length) return `All ${selectedEpisodes.length} uploaded`;
                return `${doneCount}/${selectedEpisodes.length} uploaded`;
              })()}
        </p>
        <button
          onClick={handleUploadAll}
          disabled={isUploading || !allValid || needsDecision || selectedEpisodes.length === 0 || selectedEpisodes.some((ep) => audioStatus[ep.guid] === "uploading")}
          className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2"
        >
          {isUploading && (
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          )}
          {(() => {
            if (isUploading) return "Uploading…";
            const remaining = selectedEpisodes.filter((ep) => audioStatus[ep.guid] !== "done").length;
            if (remaining === 0) return "Continue to editor →";
            if (remaining < selectedEpisodes.length) return `Upload remaining ${remaining} →`;
            return `Upload ${selectedEpisodes.length} to Yoto →`;
          })()}
        </button>
      </div>

      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmRemove(null); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-sm bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-2xl p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="font-medium">Remove episode?</h3>
              <p className="text-sm text-[var(--muted)]">
                <span className="text-[var(--foreground)]">{confirmRemove.title}</span> will be removed from this playlist. Any trim and upload progress on this track will be discarded.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { toggleEpisode(confirmRemove.guid); setConfirmRemove(null); }}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PrecisionInput({
  label, value, onChange, onUsePlayhead, placeholder, invalid, disabled, drivable,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onUsePlayhead?: () => void;
  placeholder: string;
  invalid: boolean;
  disabled?: boolean;
  drivable?: boolean;
}) {
  function nudge(direction: 1 | -1, big: boolean) {
    const cur = parseMmSs(value) ?? 0;
    const step = big ? 10 : 1;
    const next = Math.max(0, cur + direction * step);
    onChange(next > 0 ? formatMmSs(next) : "");
  }

  return (
    <label className="space-y-1.5 block">
      <span className="block text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-semibold">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={drivable ? (e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); nudge(1, e.shiftKey); }
          else if (e.key === "ArrowDown") { e.preventDefault(); nudge(-1, e.shiftKey); }
        } : undefined}
        onWheel={drivable ? (e) => {
          if (document.activeElement !== e.currentTarget) return;
          e.preventDefault();
          nudge(e.deltaY < 0 ? 1 : -1, e.shiftKey);
        } : undefined}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 text-base font-mono bg-[var(--background)] border rounded-lg focus:outline-none transition-colors disabled:opacity-50 ${
          invalid ? "border-red-400" : "border-[var(--border)] focus:border-[var(--accent)]"
        }`}
      />
      <div className="flex items-center gap-1.5">
        {onUsePlayhead && (
          <button
            type="button"
            onClick={onUsePlayhead}
            disabled={disabled}
            className={pillBtnClass}
            title="Set this time from the current playhead position"
          >
            Use playhead
          </button>
        )}
        <button
          type="button"
          onClick={() => onChange("")}
          disabled={disabled || !value}
          className={pillBtnClass}
          aria-label={`Reset ${label.toLowerCase()}`}
          title={`Reset ${label.toLowerCase()}`}
        >
          Reset
        </button>
      </div>
    </label>
  );
}
