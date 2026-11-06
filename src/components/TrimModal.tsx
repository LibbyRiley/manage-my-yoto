"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaylistTrack } from "@/types";
import { TrackScrubber, pillBtnClass, type TrackScrubberHandle, type SilenceConfig } from "@/components/TrackScrubber";

interface TrimModalProps {
  track: PlaylistTrack;
  onApply: (trimStart: number | undefined, trimEnd: number | undefined) => void;
  onClose: () => void;
}

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

export function TrimModal({ track, onApply, onClose }: TrimModalProps) {
  const scrubberRef = useRef<TrackScrubberHandle | null>(null);
  const [startInput, setStartInput] = useState(
    track.trimStart !== undefined ? formatMmSs(track.trimStart) : ""
  );
  const [endInput, setEndInput] = useState(
    track.trimEnd !== undefined ? formatMmSs(track.trimEnd) : ""
  );
  const [silences, setSilences] = useState<Array<{ start: number; end: number }>>([]);
  const [silenceConfig, setSilenceConfig] = useState<SilenceConfig>({ noiseDb: -18, minDurationSec: 0.3 });

  useEffect(() => {
    if (!track.sourceAudioUrl) return;
    let cancelled = false;
    // For uploaded tracks, sourceAudioUrl is the audio proxy URL; lift the
    // ref+cardId out of it so the silence route uses the cached file directly
    // instead of trying to fetch a relative URL server-side.
    const params = new URLSearchParams({
      noise: String(silenceConfig.noiseDb),
      dur: String(silenceConfig.minDurationSec),
    });
    if (track.sourceAudioUrl.startsWith("/api/podcasts/audio")) {
      const proxyParams = new URLSearchParams(track.sourceAudioUrl.split("?")[1] ?? "");
      const ref = proxyParams.get("ref");
      const cardId = proxyParams.get("cardId");
      if (ref) params.set("ref", ref);
      if (cardId) params.set("cardId", cardId);
    } else {
      params.set("url", track.sourceAudioUrl);
    }
    fetch(`/api/podcasts/silence?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.silences)) setSilences(data.silences);
      })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, [track.sourceAudioUrl, silenceConfig.noiseDb, silenceConfig.minDurationSec]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const startSec = parseMmSs(startInput);
  const endSec = parseMmSs(endInput);
  const startInvalid = startInput.trim() !== "" && startSec === null;
  const endInvalid = endInput.trim() !== "" && endSec === null;
  const orderInvalid = startSec !== null && endSec !== null && startSec >= endSec;
  const valid = !startInvalid && !endInvalid && !orderInvalid;

  // Numbers passed to the scrubber — undefined when input is empty or zero (start) for "no trim".
  const trimStartNum = startSec !== null && startSec > 0 ? startSec : undefined;
  const trimEndNum = endSec !== null && endSec > 0 ? endSec : undefined;

  function handleApply() {
    if (!valid) return;
    onApply(trimStartNum, trimEndNum);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-2xl bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-medium">
              {track.trackUrl?.startsWith("yoto:#") ? "Re-trim audio" : "Upload to Yoto"}
            </h3>
            <p className="text-sm text-[var(--muted)] truncate">
              {track.trackUrl?.startsWith("yoto:#")
                ? track.title
                : `${track.title} — optionally trim before uploading`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)] text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {track.sourceAudioUrl && (
          <TrackScrubber
            ref={scrubberRef}
            src={track.sourceAudioUrl.startsWith("/api/") ? track.sourceAudioUrl : `/api/podcasts/audio?url=${encodeURIComponent(track.sourceAudioUrl)}`}
            silences={silences}
            silenceConfig={silenceConfig}
            onSilenceConfigChange={setSilenceConfig}
            trimStart={trimStartNum}
            trimEnd={trimEndNum}
            onTrimChange={(s, e) => {
              setStartInput(s !== undefined && s > 0 ? formatMmSs(s) : "");
              setEndInput(e !== undefined ? formatMmSs(e) : "");
            }}
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          <PrecisionInput
            label="Start"
            value={startInput}
            onChange={setStartInput}
            onUsePlayhead={() => setStartInput(formatMmSs(scrubberRef.current?.getCurrentTime() ?? 0))}
            placeholder="from beginning"
            invalid={startInvalid}
          />
          <PrecisionInput
            label="End"
            value={endInput}
            onChange={setEndInput}
            onUsePlayhead={() => setEndInput(formatMmSs(scrubberRef.current?.getCurrentTime() ?? 0))}
            placeholder="to end"
            invalid={endInvalid}
          />
        </div>
        {orderInvalid && (
          <p className="text-xs text-red-400">Start must be before end.</p>
        )}

        {track.trackUrl?.startsWith("yoto:#") && (
          <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">
            Re-trimming uses the previously-trimmed bytes as the source. You can only shrink further — the original full episode isn&apos;t recoverable.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!valid}
            className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {(startSec ?? 0) > 0 || (endSec ?? 0) > 0 ? "Apply trim & upload" : "Upload to Yoto"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PrecisionInput({
  label, value, onChange, onUsePlayhead, placeholder, invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onUsePlayhead?: () => void;
  placeholder: string;
  invalid: boolean;
}) {
  return (
    <label className="space-y-1.5 block">
      <span className="block text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-semibold">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-base font-mono bg-[var(--card)] border rounded-lg focus:outline-none transition-colors ${
          invalid ? "border-red-400" : "border-[var(--border)] focus:border-[var(--accent)]"
        }`}
      />
      <div className="flex items-center gap-1.5">
        {onUsePlayhead && (
          <button
            type="button"
            onClick={onUsePlayhead}
            className={pillBtnClass}
            title="Set this time from the current playhead position"
          >
            Use playhead
          </button>
        )}
        <button
          type="button"
          onClick={() => onChange("")}
          disabled={!value}
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
