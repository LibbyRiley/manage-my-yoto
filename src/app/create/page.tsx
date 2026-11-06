"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { AddTracks } from "@/components/AddTracks";
import { EpisodeList } from "@/components/EpisodeList";
import { IconPicker } from "@/components/IconPicker";
import { ReviewStep } from "@/components/ReviewStep";
import { PlaylistEditor } from "@/components/PlaylistEditor";

export default function CreatePage() {
  const { step, setStep } = useAppStore();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Auth gate — wizard requires Yoto session.
  useEffect(() => {
    fetch("/api/yoto/status")
      .then((r) => r.json())
      .then((d) => {
        if (!d.connected) router.replace("/");
        else setChecking(false);
      })
      .catch(() => router.replace("/"));
  }, [router]);

  // If the user landed on /create with a stale wizard state (e.g. step still
  // set to "connect" or "editor" from a prior session), reset to the first
  // wizard step so they always start at search.
  useEffect(() => {
    if (checking) return;
    if (step !== "search" && step !== "episodes" && step !== "icons" && step !== "review" && step !== "editor") {
      setStep("search");
    }
  }, [checking, step, setStep]);

  if (checking) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {step === "search" && <AddTracks />}
      {step === "episodes" && <EpisodeList />}
      {step === "icons" && <IconPicker />}
      {step === "review" && <ReviewStep />}
      {step === "editor" && <PlaylistEditor />}
    </AppShell>
  );
}
