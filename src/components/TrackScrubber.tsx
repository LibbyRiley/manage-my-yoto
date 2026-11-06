"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

const pillBtn = "px-2.5 py-1 text-xs border border-[var(--border)] text-[var(--muted)] [&:not(:disabled)]:hover:text-[var(--accent-light)] [&:not(:disabled)]:hover:border-[var(--accent-light)] disabled:opacity-50 disabled:cursor-default rounded-full transition-colors whitespace-nowrap font-mono";

export const pillBtnClass = pillBtn;

function formatMmSs(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface SilenceRange { start: number; end: number }
export interface SilenceConfig { noiseDb: number; minDurationSec: number }

interface TrackScrubberProps {
  src: string;
  trimStart?: number;
  trimEnd?: number;
  silences?: SilenceRange[];
  silenceConfig?: SilenceConfig;
  onSilenceConfigChange?: (config: SilenceConfig) => void;
  onTrimChange: (start: number | undefined, end: number | undefined) => void;
  onDurationChange?: (duration: number) => void;
  disabled?: boolean;
}

export interface TrackScrubberHandle {
  getCurrentTime: () => number;
}

export const TrackScrubber = forwardRef<TrackScrubberHandle, TrackScrubberProps>(function TrackScrubber({ src, trimStart, trimEnd, silences, silenceConfig, onSilenceConfigChange, onTrimChange, onDurationChange, disabled }, ref) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreviewingTrim, setIsPreviewingTrim] = useState(false);
  const [silencesVisible, setSilencesVisible] = useState(false);

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => audioRef.current?.currentTime ?? 0,
  }));

  const startSec = trimStart ?? 0;
  const endSec = trimEnd ?? duration;
  const startPct = duration > 0 ? (startSec / duration) * 100 : 0;
  const endPct = duration > 0 ? (endSec / duration) * 100 : 100;
  const playheadPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const hasTrim = trimStart !== undefined || trimEnd !== undefined;

  function pointerToSec(clientX: number): number {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pct * duration;
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
    containerRef.current?.focus();
  }

  function seek(t: number) {
    const a = audioRef.current;
    if (!a || duration === 0) return;
    a.currentTime = Math.max(0, Math.min(duration, t));
  }

  function skipBy(delta: number) {
    seek(currentTime + delta);
  }

  function previewTrim() {
    const a = audioRef.current;
    if (!a || duration <= 0) return;
    if (isPreviewingTrim) {
      a.pause();
      return; // pause listener (registered below) will clear preview state
    }
    const s = trimStart ?? 0;
    const e = trimEnd ?? duration;
    const cur = currentTime;
    const seekTo = cur < s ? s : cur > e ? Math.max(s, e - 5) : cur;
    a.currentTime = seekTo;
    void a.play();
    setIsPreviewingTrim(true);
    const onTimeUpdate = () => {
      if (trimEnd !== undefined && a.currentTime >= e) a.pause();
    };
    const cleanup = () => {
      a.removeEventListener("timeupdate", onTimeUpdate);
      a.removeEventListener("pause", cleanup);
      a.removeEventListener("ended", cleanup);
      setIsPreviewingTrim(false);
    };
    a.addEventListener("timeupdate", onTimeUpdate);
    a.addEventListener("pause", cleanup);
    a.addEventListener("ended", cleanup);
  }

  function startDrag(handle: "start" | "end" | "playhead") {
    return (e: React.PointerEvent) => {
      if (disabled || duration === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const minGap = 0.5;
      const onMove = (ev: PointerEvent) => {
        const t = pointerToSec(ev.clientX);
        if (handle === "start") {
          const clamped = Math.max(0, Math.min(t, endSec - minGap));
          onTrimChange(clamped > 0 ? clamped : undefined, trimEnd);
        } else if (handle === "end") {
          const clamped = Math.min(duration, Math.max(t, startSec + minGap));
          onTrimChange(trimStart, clamped < duration ? clamped : undefined);
        } else {
          seek(t);
        }
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    };
  }

  function onBarPointerDown(e: React.PointerEvent) {
    if (disabled || duration === 0) return;
    if ((e.target as HTMLElement).closest("[data-handle]")) return;
    seek(pointerToSec(e.clientX));
    containerRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    // Don't intercept keys typed into nested inputs (none today, but safe).
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      skipBy(e.shiftKey ? -30 : -5);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      skipBy(e.shiftKey ? 30 : 5);
    }
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="space-y-1.5 outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]/50 rounded-lg"
    >
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration || 0;
          setDuration(d);
          onDurationChange?.(d);
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrentTime(t);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />

      <div className="grid grid-cols-3 items-center gap-2">
        <div className="justify-self-start flex items-center gap-2 flex-wrap min-w-0">
          <button
            type="button"
            onClick={previewTrim}
            disabled={disabled || duration === 0 || !hasTrim}
            className={pillBtn}
            title={
              !hasTrim
                ? "Set a start or end to preview"
                : isPreviewingTrim
                  ? "Pause the trim preview"
                  : "Play just the trim region"
            }
            aria-label={isPreviewingTrim ? "Pause trim preview" : "Preview trim"}
          >
            {isPreviewingTrim ? "⏸ Pause trim" : "▶ Preview trim"}
          </button>
          {(silences && silences.length > 0) || onSilenceConfigChange ? (
            <>
              <button
                type="button"
                onClick={() => setSilencesVisible((v) => !v)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors whitespace-nowrap font-mono border ${
                  silencesVisible
                    ? "bg-pink-400/15 border-pink-400 text-pink-300 hover:bg-pink-400/25"
                    : "border-pink-400/60 text-pink-400 hover:border-pink-300 hover:text-pink-300"
                }`}
                title={silencesVisible ? `Hide ${silences?.length ?? 0} silence indicator${(silences?.length ?? 0) !== 1 ? "s" : ""}` : `Show ${silences?.length ?? 0} silence indicator${(silences?.length ?? 0) !== 1 ? "s" : ""}`}
              >
                {silencesVisible ? `◉ Silences (${silences?.length ?? 0})` : `◯ Silences (${silences?.length ?? 0})`}
              </button>
              {onSilenceConfigChange && silenceConfig && silencesVisible && (
                <SilenceConfigInputs
                  config={silenceConfig}
                  onChange={onSilenceConfigChange}
                  disabled={disabled}
                />
              )}
            </>
          ) : null}
        </div>
        <div className="justify-self-center flex items-center gap-2">
          <button
            type="button"
            onClick={() => skipBy(-15)}
            disabled={disabled || duration === 0}
            className={pillBtn}
            aria-label="Skip back 15 seconds"
            title="Skip back 15 seconds"
          >
            −15s
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={disabled || duration === 0}
            className="w-9 h-9 flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-full transition-colors text-xs shrink-0"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            onClick={() => skipBy(15)}
            disabled={disabled || duration === 0}
            className={pillBtn}
            aria-label="Skip forward 15 seconds"
            title="Skip forward 15 seconds"
          >
            +15s
          </button>
        </div>
        <span className="justify-self-end font-mono text-xs text-[var(--muted)] tabular-nums">
          {formatMmSs(currentTime)} / {formatMmSs(duration)}
        </span>
      </div>

      <div
        ref={barRef}
        onPointerDown={onBarPointerDown}
        className={`relative h-9 select-none touch-none mx-2 ${disabled ? "" : "cursor-pointer"}`}
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-[var(--border)] rounded-full" />
        {duration > 0 && (
          <div
            className={hasTrim ? "absolute top-1/2 -translate-y-1/2 h-2 bg-[var(--accent)] rounded-full" : "absolute top-1/2 -translate-y-1/2 h-2 bg-[var(--accent)]/40 rounded-full"}
            style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
          />
        )}
        {/* Silence bands sit ABOVE the trim region so they're visible whether trimmed or not.
            Diagonal stripes give a clear "skip-worthy" texture distinct from the solid trim fill. */}
        {duration > 0 && silencesVisible && silences && silences.length > 0 && silences.map((s, i) => {
          const left = (s.start / duration) * 100;
          const width = ((s.end - s.start) / duration) * 100;
          if (width <= 0) return null;
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 h-3 rounded-sm pointer-events-none ring-1 ring-pink-400/50"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(244, 114, 182, 0.75) 0 3px, rgba(244, 114, 182, 0) 3px 6px)",
              }}
              title={`Silence · ${formatMmSs(s.start)}–${formatMmSs(s.end)} (${(s.end - s.start).toFixed(1)}s)`}
            />
          );
        })}
        {duration > 0 && (
          <button
            type="button"
            data-handle
            aria-label="Drag to set start"
            disabled={disabled}
            onPointerDown={startDrag("start")}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-5 rounded-sm bg-white shadow ring-1 ring-black/40 cursor-ew-resize disabled:cursor-default disabled:opacity-50 hover:scale-110 transition-transform z-10"
            style={{ left: `${startPct}%` }}
          />
        )}
        {duration > 0 && (
          <button
            type="button"
            data-handle
            aria-label="Drag to set end"
            disabled={disabled}
            onPointerDown={startDrag("end")}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-5 rounded-sm bg-white shadow ring-1 ring-black/40 cursor-ew-resize disabled:cursor-default disabled:opacity-50 hover:scale-110 transition-transform z-10"
            style={{ left: `${endPct}%` }}
          />
        )}
        {duration > 0 && (
          <div
            data-handle
            onPointerDown={startDrag("playhead")}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-6 bg-yellow-300 rounded-full z-20 ${disabled ? "" : "cursor-ew-resize"}`}
            style={{ left: `${playheadPct}%` }}
            title={`Playhead · ${formatMmSs(currentTime)}`}
          />
        )}
      </div>

      <p className={`text-[10px] font-mono text-right ${hasTrim && duration > 0 ? "text-[var(--accent-light)]" : "text-transparent select-none pointer-events-none"}`}>
        Will upload: {formatMmSs(startSec)} – {formatMmSs(endSec)} ({formatMmSs(endSec - startSec)})
      </p>
    </div>
  );
});

function SilenceConfigInputs({
  config,
  onChange,
  disabled,
}: {
  config: SilenceConfig;
  onChange: (config: SilenceConfig) => void;
  disabled?: boolean;
}) {
  function nudgeNoise(direction: 1 | -1, big: boolean) {
    const step = big ? 4 : 1;
    const next = Math.max(-60, Math.min(0, config.noiseDb + direction * step));
    onChange({ ...config, noiseDb: next });
  }
  function nudgeDur(direction: 1 | -1, big: boolean) {
    const step = big ? 0.5 : 0.1;
    const next = Math.max(0.1, Math.min(10, +(config.minDurationSec + direction * step).toFixed(2)));
    onChange({ ...config, minDurationSec: next });
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-mono text-pink-400/80">
      <label className="flex items-center gap-1" title="Noise floor — louder threshold detects more silences. Click then ↑/↓ to nudge (Shift = bigger step).">
        <span className="opacity-60">dB</span>
        <input
          type="text"
          value={config.noiseDb}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange({ ...config, noiseDb: n });
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); nudgeNoise(1, e.shiftKey); }
            else if (e.key === "ArrowDown") { e.preventDefault(); nudgeNoise(-1, e.shiftKey); }
          }}
          disabled={disabled}
          className="w-9 bg-transparent border border-pink-400/30 rounded px-1 py-0.5 text-center focus:outline-none focus:border-pink-300 disabled:opacity-50"
        />
      </label>
      <label className="flex items-center gap-1" title="Minimum silence duration in seconds. Smaller = catches shorter pauses. ↑/↓ to nudge (Shift = bigger step).">
        <span className="opacity-60">s</span>
        <input
          type="text"
          value={config.minDurationSec}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n > 0) onChange({ ...config, minDurationSec: n });
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") { e.preventDefault(); nudgeDur(1, e.shiftKey); }
            else if (e.key === "ArrowDown") { e.preventDefault(); nudgeDur(-1, e.shiftKey); }
          }}
          disabled={disabled}
          className="w-9 bg-transparent border border-pink-400/30 rounded px-1 py-0.5 text-center focus:outline-none focus:border-pink-300 disabled:opacity-50"
        />
      </label>
    </span>
  );
}
