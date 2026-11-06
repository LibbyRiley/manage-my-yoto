"use client";

import type { YotoIcon } from "@/types";

interface IconCandidateProps {
  icon: YotoIcon;
  isSelected: boolean;
  onSelect: () => void;
}

export function IconCandidate({ icon, isSelected, onSelect }: IconCandidateProps) {
  const imgSrc = icon.previewDataUrl || icon.url;
  const label = icon.reason ?? icon.title;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={label}
      className={`group relative flex items-center justify-center p-1 rounded-md transition-all w-[56px] h-[56px] hover:z-10 ${
        isSelected
          ? "bg-[var(--accent)]/15 ring-2 ring-[var(--accent)] scale-105"
          : "bg-[var(--card)] hover:bg-[var(--card-hover)] hover:scale-110 ring-1 ring-[var(--border)]"
      }`}
    >
      <img
        src={imgSrc}
        alt={label}
        width={40}
        height={40}
        className="pixel-render rounded-sm"
        style={{ imageRendering: "pixelated" }}
      />

      <div className={`absolute -top-1 -right-1 w-4 h-4 bg-[var(--accent)] rounded-full flex items-center justify-center transition-transform duration-150 origin-center ${isSelected ? "scale-100" : "scale-0"}`}>
        <span className="text-white text-[9px] leading-none">✓</span>
      </div>

      <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap px-1.5 py-0.5 rounded text-[9px] leading-tight bg-[var(--card)] ring-1 ring-[var(--border)] text-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity duration-100 z-10 max-w-[120px] truncate">
        {label}
      </span>
    </button>
  );
}
