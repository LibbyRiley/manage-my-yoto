"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { YotoIcon } from "@/types";

interface UserIcon {
  displayIconId: string;
  url: string;
  createdAt: string;
}

interface UploadEntry {
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  url?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface PublicIcon {
  displayIconId: string;
  title: string;
  url: string;
  tags: string[];
}

export function IconLibraryManager() {
  const [tab, setTab] = useState<"mine" | "public" | "yotoicons">("mine");

  // My Icons
  const [icons, setIcons] = useState<UserIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Public Library
  const [publicIcons, setPublicIcons] = useState<PublicIcon[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicQuery, setPublicQuery] = useState("");

  // Yotoicons.com search
  const [yotoQuery, setYotoQuery] = useState("");
  const [yotoIcons, setYotoIcons] = useState<YotoIcon[]>([]);
  const [yotoLoading, setYotoLoading] = useState(false);
  const [yotoSearched, setYotoSearched] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/yoto/user-icons")
      .then((r) => r.json())
      .then((d) => setIcons(d.icons ?? []))
      .catch(() => setError("Failed to load icons"))
      .finally(() => setLoading(false));
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

  async function runUploads(files: File[]) {
    setIsUploading(true);
    for (const file of files) {
      setUploads((prev) => prev.map((u) => u.file === file ? { ...u, status: "uploading" } : u));
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const res = await fetch("/api/yoto/upload-icon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: dataUrl, filename: file.name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setUploads((prev) => prev.map((u) => u.file === file ? { ...u, status: "done", url: dataUrl } : u));
        if (data.mediaId) {
          setIcons((prev) => [{ displayIconId: data.mediaId, url: dataUrl, createdAt: new Date().toISOString() }, ...prev]);
        }
      } catch (err) {
        setUploads((prev) => prev.map((u) => u.file === file ? { ...u, status: "error", error: err instanceof Error ? err.message : "Failed" } : u));
      }
    }
    setIsUploading(false);
    // Re-fetch to get Yoto-hosted URLs replacing local data URLs
    fetch("/api/yoto/user-icons")
      .then((r) => r.json())
      .then((d) => { if (d.icons) setIcons(d.icons); })
      .catch(() => {});
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const entries: UploadEntry[] = files.map((file) => ({ file, status: "queued" }));
    setUploads(entries);
    runUploads(files);
    e.target.value = "";
  }

  async function searchYotoicons(q: string) {
    setYotoLoading(true);
    setYotoSearched(true);
    try {
      const res = await fetch(`/api/icons/yotoicons-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setYotoIcons(data.icons ?? []);
    } catch {
      setYotoIcons([]);
    } finally {
      setYotoLoading(false);
    }
  }

  async function saveYotoicon(icon: YotoIcon) {
    setSavingId(icon.id);
    try {
      const res = await fetch("/api/yoto/upload-icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: icon.url, filename: `${icon.id}.png` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (data.mediaId) {
        setIcons((prev) => {
          if (prev.some((ic) => ic.displayIconId === data.mediaId)) return prev;
          return [{ displayIconId: data.mediaId, url: icon.url, createdAt: new Date().toISOString() }, ...prev];
        });
      }
    } finally {
      setSavingId(null);
    }
  }

  const filteredPublic = (() => {
    const q = publicQuery.trim().toLowerCase();
    if (!q) return publicIcons;
    return publicIcons.filter((ic) =>
      ic.title.toLowerCase().includes(q) ||
      ic.tags.some((t) => t.toLowerCase().includes(q))
    );
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <h2 className="font-medium">Icon Library</h2>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--card)] border border-[var(--border)] rounded-lg w-fit">
        {(["mine", "public", "yotoicons"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              tab === t
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t === "mine"
              ? `My Icons${icons.length ? ` (${icons.length})` : ""}`
              : t === "public"
              ? "Public Library"
              : "yotoicons.com"}
          </button>
        ))}
      </div>

      {/* ── My Icons tab ── */}
      {tab === "mine" && (
        <>
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
          )}

          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              dragCounter.current = 0;
              setIsDragging(false);
              if (isUploading) return;
              const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
              if (files.length === 0) return;
              const entries: UploadEntry[] = files.map((file) => ({ file, status: "queued" }));
              setUploads(entries);
              runUploads(files);
            }}
            className={`flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
              isDragging
                ? "border-[var(--accent)] bg-[var(--accent)]/5"
                : "border-[var(--border)] hover:border-[var(--accent-light)]/50 hover:bg-[var(--card)]"
            } ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span className="text-2xl text-[var(--muted)]">↑</span>
            <p className="text-sm text-[var(--muted)]">
              {isUploading ? "Uploading…" : isDragging ? "Drop to upload" : "Drop images here or click to browse"}
            </p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" disabled={isUploading} onChange={handleFileChange} />
          </div>

          {uploads.length > 0 && (
            <div className="p-4 bg-[var(--card)] border border-[var(--border)] rounded-lg space-y-2">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Upload queue</p>
              {uploads.map((u, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  {u.status === "queued" && <span className="w-2 h-2 rounded-full bg-[var(--muted)] shrink-0" />}
                  {u.status === "uploading" && <div className="w-3 h-3 border border-[var(--accent)] border-t-transparent rounded-full animate-spin shrink-0" />}
                  {u.status === "done" && <span className="text-green-400 shrink-0">✓</span>}
                  {u.status === "error" && <span className="text-red-400 shrink-0">✕</span>}
                  <span className="flex-1 truncate text-[var(--foreground)]">{u.file.name}</span>
                  {u.status === "done" && u.url && (
                    <img src={u.url} alt="" width={24} height={24} style={{ imageRendering: "pixelated" }} className="rounded-sm shrink-0" />
                  )}
                  {u.status === "error" && u.error && (
                    <span className="text-xs text-red-400 shrink-0">{u.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : icons.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-[var(--muted)]">No icons uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {icons.map((icon, index) => {
                  const label = (icon.displayIconId ?? "").slice(0, 8);
                  return (
                    <div key={icon.displayIconId} className="relative group flex flex-col items-center gap-1" style={{ animation: "fadeInUp 200ms ease both", animationDelay: `${index * 20}ms` }}>
                      <div className="w-12 h-12 rounded-lg bg-[var(--card)] border border-[var(--border)] overflow-hidden">
                        <img src={icon.url} alt={label} width={48} height={48} style={{ imageRendering: "pixelated" }} className="w-full h-full object-contain" />
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[var(--foreground)] text-[var(--background)] text-[10px] rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 max-w-[120px] truncate">
                        {label}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* ── yotoicons.com tab ── */}
      {tab === "yotoicons" && (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); const q = yotoQuery.trim(); if (q) searchYotoicons(q); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={yotoQuery}
              onChange={(e) => setYotoQuery(e.target.value)}
              placeholder="Search yotoicons.com…"
              className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              autoFocus
            />
            <button
              type="submit"
              disabled={!yotoQuery.trim() || yotoLoading}
              className="px-4 py-2 text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-lg transition-colors shrink-0"
            >
              {yotoLoading ? "Searching…" : "Search"}
            </button>
          </form>

          {yotoLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !yotoSearched ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">Search for icons from yotoicons.com</p>
          ) : yotoIcons.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">No icons found for &ldquo;{yotoQuery}&rdquo;</p>
          ) : (
            <>
              <p className="text-xs text-[var(--muted)]">{yotoIcons.length} result{yotoIcons.length !== 1 ? "s" : ""} — click to save to My Icons</p>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {yotoIcons.map((icon, index) => {
                  const isSaving = savingId === icon.id;
                  const tooltipText = icon.tags.length
                    ? `${icon.title} · ${icon.tags.join(", ")}`
                    : icon.title;
                  return (
                    <button
                      key={icon.id}
                      onClick={() => saveYotoicon(icon)}
                      disabled={isSaving}
                      title={`Save "${icon.title}" to My Icons`}
                      className="relative group flex flex-col items-center gap-1 disabled:opacity-60"
                      style={{ animation: "fadeInUp 200ms ease both", animationDelay: `${index * 20}ms` }}
                    >
                      <div className="w-12 h-12 rounded-lg bg-[var(--card)] border border-[var(--border)] overflow-hidden hover:border-[var(--accent-light)] hover:ring-1 hover:ring-[var(--accent)] transition-all">
                        {isSaving ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <img
                            src={icon.previewDataUrl ?? icon.url}
                            alt={icon.title}
                            width={48}
                            height={48}
                            style={{ imageRendering: "pixelated" }}
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>
                      <p className="text-[9px] text-[var(--muted)] truncate w-full text-center leading-tight">{icon.title}</p>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[var(--foreground)] text-[var(--background)] text-[10px] rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 max-w-[160px] truncate">
                        {tooltipText}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Public Library tab ── */}
      {tab === "public" && (
        <>
          <input
            type="text"
            value={publicQuery}
            onChange={(e) => setPublicQuery(e.target.value)}
            placeholder="Search by name or tag…"
            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            autoFocus
          />

          {publicLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredPublic.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">
              {publicQuery ? `No icons match "${publicQuery}"` : "No public icons found"}
            </p>
          ) : (
            <>
              {publicQuery && (
                <p className="text-xs text-[var(--muted)]">{filteredPublic.length} result{filteredPublic.length !== 1 ? "s" : ""}</p>
              )}
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {filteredPublic.map((icon, index) => {
                  const tooltipText = icon.tags.length
                    ? `${icon.title} · ${icon.tags.join(", ")}`
                    : icon.title;
                  return (
                    <div key={icon.displayIconId} className="relative group flex flex-col items-center gap-1" style={{ animation: "fadeInUp 200ms ease both", animationDelay: `${index * 20}ms` }}>
                      <div className="w-12 h-12 rounded-lg bg-[var(--card)] border border-[var(--border)] overflow-hidden">
                        <img src={icon.url} alt={icon.title} width={48} height={48} style={{ imageRendering: "pixelated" }} className="w-full h-full object-contain" />
                      </div>
                      <p className="text-[9px] text-[var(--muted)] truncate w-full text-center leading-tight">{icon.title}</p>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[var(--foreground)] text-[var(--background)] text-[10px] rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 max-w-[160px] truncate">
                        {tooltipText}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
