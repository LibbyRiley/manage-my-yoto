"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const playerUrl = useAppStore((s) => s.playerUrl);
  const playerTitle = useAppStore((s) => s.playerTitle);
  const clearPlayer = useAppStore((s) => s.clearPlayer);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playerUrl) return;
    setCurrentTime(0);
    setDuration(0);
    setError(false);
    setBuffering(true);
    audio.src = playerUrl;
    audio.play();
    setPlaying(true);
  }, [playerUrl]);

  if (!playerUrl) return null;

  const audio = audioRef.current;

  function togglePlay() {
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)] border-t border-[var(--border)] px-4 py-3 flex items-center gap-4">
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => { if (audio) setCurrentTime(audio.currentTime); }}
        onDurationChange={() => { if (audio) setDuration(audio.duration); }}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => { setBuffering(false); setError(false); }}
        onError={() => { setError(true); setBuffering(false); setPlaying(false); }}
        onEnded={() => setPlaying(false)}
      />

      <button
        onClick={togglePlay}
        disabled={error}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors shrink-0 text-white text-sm"
      >
        {buffering ? (
          <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : playing ? (
          "⏸"
        ) : (
          "▶"
        )}
      </button>

      <p className="text-sm font-medium truncate flex-1 min-w-0">{playerTitle}</p>

      {error && <span className="text-xs text-red-400 shrink-0">Failed to load</span>}

      {!error && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[var(--muted)] font-mono w-10 text-right">{fmt(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              if (audioRef.current) audioRef.current.currentTime = Number(e.target.value);
            }}
            className="w-32 accent-[var(--accent)]"
          />
          <span className="text-xs text-[var(--muted)] font-mono w-10">{fmt(duration)}</span>
        </div>
      )}

      <button
        onClick={clearPlayer}
        className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors shrink-0 text-lg leading-none"
      >
        ✕
      </button>
    </div>
  );
}
