"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

const SOURCES: { mode: "rss" | "custom" | "radio" | "youtube"; title: string; description: string; gradient: string; image: string }[] = [
  {
    mode: "rss",
    title: "Podcast / RSS",
    description: "Import episodes from any podcast feed URL",
    gradient: "linear-gradient(135deg, hsl(195 80% 18%) 0%, hsl(210 70% 10%) 100%)",
    image: "/images/source-rss.jpg",
  },
  {
    mode: "custom",
    title: "Custom Tracks",
    description: "Upload your own audio files or paste URLs",
    gradient: "linear-gradient(135deg, hsl(265 55% 20%) 0%, hsl(280 50% 10%) 100%)",
    image: "/images/source-custom.jpg",
  },
  {
    mode: "radio",
    title: "Radio Station",
    description: "Add live radio streams to your card",
    gradient: "linear-gradient(135deg, hsl(340 60% 20%) 0%, hsl(355 55% 10%) 100%)",
    image: "/images/source-radio.jpg",
  },
  {
    mode: "youtube",
    title: "YouTube Playlist",
    description: "Convert a YouTube playlist to audio tracks",
    gradient: "linear-gradient(135deg, hsl(15 70% 20%) 0%, hsl(30 65% 10%) 100%)",
    image: "/images/source-youtube.jpg",
  },
];

export function ConnectYoto() {
  const { setStep } = useAppStore();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Only redirect to /library if the user JUST completed OAuth (the callback
    // route appends ?yoto_connected). Visiting / directly — including via the
    // app title link — should keep the user on the showcase.
    const justAuthed = typeof window !== "undefined" &&
      new URL(window.location.href).searchParams.has("yoto_connected");

    if (justAuthed) {
      // Strip the param and bounce to /library.
      const url = new URL(window.location.href);
      url.searchParams.delete("yoto_connected");
      window.history.replaceState({}, "", url.toString());
      router.replace("/library");
      return; // keep `checking` true so the spinner stays up during nav
    }

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("yoto_error")) {
        url.searchParams.delete("yoto_error");
        window.history.replaceState({}, "", url.toString());
      }
    }

    fetch("/api/yoto/status")
      .then((r) => r.json())
      .then((d) => setConnected(!!d.connected))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-16 py-8">
      {/* Hero */}
      <section className="text-center space-y-6 pt-8">
        <h1 className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
          Build <span className="text-[#f85e42]">Yoto cards</span><br />
          from anything you can stream
        </h1>
        <p className="text-base text-[var(--muted)] max-w-md mx-auto leading-relaxed">
          Podcasts, YouTube playlists, radio stations, your own audio files. Pick
          pixel-art icons, trim out the bits you don&apos;t want, push the whole
          thing to a Yoto MYO card in one go.
        </p>
        {!connected && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <a
              href="/api/yoto/login"
              className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-colors"
            >
              Connect Yoto to start
            </a>
            <button
              onClick={() => setStep("search")}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Or skip — download as a zip instead
            </button>
          </div>
        )}
      </section>

      {/* Get Started — only when connected. Same gradient/image cards as the wizard's source picker. */}
      {connected && (
        <section className="space-y-5">
          <div className="text-center">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">Get started</h2>
            <p className="text-sm text-[var(--muted)] mt-1">Pick a source for your new playlist.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {SOURCES.map((source) => (
              <Link
                key={source.mode}
                href={`/create?source=${source.mode}`}
                className="group flex flex-col bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent-light)] hover:-translate-y-1 hover:shadow-xl rounded-xl text-left transition-all duration-200 overflow-hidden"
              >
                <div className="relative w-full" style={{ aspectRatio: "3 / 2" }}>
                  <div className="absolute inset-0" style={{ background: source.gradient }} />
                  <img
                    src={source.image}
                    data-card={source.mode}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover group-hover:brightness-110 transition-all duration-200"
                  />
                </div>
                <div className="flex flex-col gap-1 px-4 py-3 flex-1">
                  <p className="font-semibold text-sm leading-snug">{source.title}</p>
                  <p className="text-xs text-[var(--muted)] leading-relaxed">{source.description}</p>
                  <span className="mt-auto pt-2 text-xs font-medium text-[var(--accent-light)] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    Choose →
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center pt-2">
            <Link href="/library" className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
              Or pick up where you left off →
            </Link>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="space-y-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted)] text-center">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Step
            num="01"
            title="Pick your source"
            body="Podcast feed, YouTube playlist, radio station, or upload your own audio files. Mix and match in one card."
          />
          <Step
            num="02"
            title="Pick icons & trim"
            body="Yoto-library icons, yotoicons.com, or your own. Optionally trim intros, ads, and outros."
          />
          <Step
            num="03"
            title="Push to Yoto"
            body="Upload to a MYO card with proper scrubbing support. Drag-to-reorder, batch rename, save."
          />
        </div>
      </section>

      {/* Features */}
      <section className="space-y-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted)] text-center">
          What's inside
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Feature
            title="Podcasts, RSS-first"
            body="Import episodes from any podcast feed — paste an RSS URL or search by name."
          />
          <Feature
            title="YouTube playlists"
            body="Pull a YouTube playlist, choose which videos to import, and audio is extracted server-side via yt-dlp."
          />
          <Feature
            title="Radio stations"
            body="Add live internet radio streams as tracks. Type a stream URL or pick from a curated list."
          />
          <Feature
            title="Custom audio files"
            body="Drop in your own MP3s — voice memos, audiobooks, music, anything — and they upload alongside the rest."
          />
          <Feature
            title="Pixel-art icon picker"
            body="Mix the Yoto library, search yotoicons.com, your own uploads, and downscaled cover art."
          />
          <Feature
            title="Per-track trim with scrubber"
            body="Custom audio scrubber with draggable trim handles. Cut intros, ads, and outros with frame-accurate ffmpeg re-encoding."
          />
          <Feature
            title="Bulk skip first / skip last"
            body="Drive a single number to cut the same intro and outro length off every track — perfect for podcasts with consistent ad placement."
          />
          <Feature
            title="Real Yoto uploads"
            body="Audio goes to Yoto's CDN so it's properly scrubbable in the Yoto app — not stuck as a stream-only URL."
          />
          <Feature
            title="Playlist editor"
            body="Drag-to-reorder, batch rename with regex, sort by date, replace cover art, edit per-track icons."
          />
        </div>
      </section>

      {/* Footer note */}
      <section className="text-center pt-4 pb-8">
        <p className="text-xs text-[var(--muted)] max-w-sm mx-auto leading-relaxed">
          Local-only app. Audio is fetched, trimmed, and uploaded from your machine.
          Nothing is sent anywhere except your Yoto account.
        </p>
      </section>
    </div>
  );
}

function Step({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-2">
      <span className="text-[10px] font-mono font-semibold tracking-wider text-[#f85e42]">{num}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-[var(--muted)] leading-relaxed">{body}</p>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-1.5 hover:border-[var(--accent-light)]/40 transition-colors">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-[var(--muted)] leading-relaxed">{body}</p>
    </div>
  );
}
