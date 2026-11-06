"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import type { WizardStep } from "@/types";
import { PlayerBar } from "@/components/PlayerBar";

function FlowBreadcrumb({ onCreatePlaylist }: { onCreatePlaylist: () => void }) {
  const { step, setStep, podcast, selectedCard, iconSelections } = useAppStore();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  type Crumb = { label: string; target?: WizardStep | "/library"; href?: string; isCurrent: boolean };

  const crumbs: Crumb[] = (() => {
    // Editor sub-routes: derive crumbs from URL, not from wizard step.
    const editorMatch = pathname.match(/^\/editor\/([^/]+)(\/.*)?$/);
    if (editorMatch) {
      const [, cardId, rest = ""] = editorMatch;
      const libraryCrumb: Crumb = { label: "Playlist Library", target: "/library", isCurrent: false };
      const cardLabel = selectedCard?.title ?? "Playlist";
      const cardCrumb = (isCurrent: boolean): Crumb => ({ label: cardLabel, href: `/editor/${cardId}`, isCurrent });

      if (rest === "") return [libraryCrumb, cardCrumb(true)];
      if (rest === "/icons") return [libraryCrumb, cardCrumb(false), { label: "Edit all icons", href: pathname, isCurrent: true }];
      if (rest === "/tracks/new") return [libraryCrumb, cardCrumb(false), { label: "Add tracks", href: pathname, isCurrent: true }];
      if (/^\/tracks\/[^/]+\/icon$/.test(rest)) return [libraryCrumb, cardCrumb(false), { label: "Edit icon", href: pathname, isCurrent: true }];
      return [libraryCrumb, cardCrumb(true)];
    }

    const hasIcons = iconSelections.length > 0;
    const createFirst: Crumb = { label: "Create Playlist", target: "search", isCurrent: false };

    switch (step) {
      case "episodes":
        return [
          createFirst,
          { label: podcast?.title ?? "Episodes", target: "episodes", isCurrent: true },
          ...(hasIcons ? [{ label: "Icons", target: "icons" as WizardStep, isCurrent: false }] : []),
        ];
      case "icons":
        return [
          createFirst,
          { label: podcast?.title ?? "Episodes", target: "episodes", isCurrent: false },
          { label: "Icons", target: "icons", isCurrent: true },
        ];
      case "review":
        return [
          createFirst,
          { label: podcast?.title ?? "Episodes", target: "episodes", isCurrent: false },
          { label: "Icons", target: "icons", isCurrent: false },
          { label: "Review & trim", target: "review", isCurrent: true },
        ];
      case "editor":
        return [
          createFirst,
          ...(podcast ? [{ label: podcast.title, target: "episodes" as WizardStep, isCurrent: false }] : []),
          ...(hasIcons ? [{ label: "Icons", target: "icons" as WizardStep, isCurrent: false }] : []),
          { label: "Save Playlist", target: "editor", isCurrent: true },
        ];
      default:
        return [];
    }
  })();

  if (crumbs.length === 0) return null;

  function navigate(crumb: Crumb) {
    if (crumb.href) {
      router.push(crumb.href);
    } else if (crumb.target === "/library") {
      router.push("/library");
    } else if (crumb.target === "search") {
      onCreatePlaylist();
    } else if (crumb.target) {
      setStep(crumb.target);
    }
  }

  return (
    <nav className="flex items-center gap-1 mt-3 -ml-2.5">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-[var(--muted)] text-xs px-0.5">›</span>}
          {crumb.isCurrent ? (
            <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-[var(--accent)]/15 text-[var(--accent-light)]">
              {crumb.label}
            </span>
          ) : (
            <button
              onClick={() => navigate(crumb)}
              className="px-2.5 py-1 text-xs rounded-md text-[var(--muted)] bg-[var(--card)] border border-[var(--border)] hover:text-[var(--foreground)] hover:border-[var(--accent-light)]/50 transition-colors"
            >
              {crumb.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const {
    editingCardId, playlistTracks, podcast,
    setStep, setSelectedCard, setEditingCardId, setPlaylistTracks,
    setPodcast, setEpisodes, setIconSelections,
  } = useAppStore();
  const router = useRouter();
  const pathname = usePathname();
  const [yotoConnected, setYotoConnected] = useState(false);
  const [showNewPlaylistConfirm, setShowNewPlaylistConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/yoto/status")
      .then((r) => r.json())
      .then((d) => setYotoConnected(d.connected))
      .catch(() => {});
  }, [pathname]);

  function handleNewPlaylist() {
    const hasProgress = editingCardId === null && (playlistTracks.length > 0 || podcast !== null);
    if (hasProgress) { setShowNewPlaylistConfirm(true); return; }
    doStartNewPlaylist();
  }

  function doStartNewPlaylist() {
    setShowNewPlaylistConfirm(false);
    setSelectedCard(null);
    setEditingCardId(null);
    setPlaylistTracks([]);
    setPodcast(null);
    setEpisodes([]);
    setIconSelections([]);
    setStep("search");
    router.push("/create");
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
              Your Yoto Library
            </Link>
            <a
              href="/api/yoto/login"
              title="Reconnect Yoto"
              className={`text-xs transition-colors hover:opacity-70 ${yotoConnected ? "text-[var(--success)]" : "text-[var(--muted)]"}`}
            >
              {yotoConnected ? "● Yoto" : "○ Yoto"}
            </a>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/library"
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                pathname === "/library" ? "text-[var(--foreground)] font-medium" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Playlists
            </Link>
            <Link
              href="/icons"
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                pathname === "/icons" ? "text-[var(--foreground)] font-medium" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Icons
            </Link>
            <button
              onClick={handleNewPlaylist}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f85e42] hover:bg-[#e44a30] text-white text-sm font-medium rounded-lg transition-colors"
            >
              <span className="text-base leading-none">+</span>
              New Playlist
            </button>
          </nav>
        </div>
        {(pathname === "/create" || pathname?.startsWith("/editor/")) && (
          <FlowBreadcrumb onCreatePlaylist={handleNewPlaylist} />
        )}
      </header>

      <div className="min-h-[60vh]">{children}</div>
      <PlayerBar />

      {showNewPlaylistConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewPlaylistConfirm(false); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-sm bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-2xl p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="font-medium">Start a new playlist?</h3>
              <p className="text-sm text-[var(--muted)]">Your current progress will be discarded. This cannot be undone.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewPlaylistConfirm(false)}
                className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={doStartNewPlaylist}
                className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
              >
                Start new playlist
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
