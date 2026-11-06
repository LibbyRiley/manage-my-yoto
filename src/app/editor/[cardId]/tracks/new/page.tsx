"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { AddTracks } from "@/components/AddTracks";
import { EpisodeList } from "@/components/EpisodeList";
import { IconPicker } from "@/components/IconPicker";
import { ReviewStep } from "@/components/ReviewStep";

export default function AddTracksPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const router = useRouter();
  const step = useAppStore((s) => s.step);
  const editingCardId = useAppStore((s) => s.editingCardId);

  // Completion: any sub-step lands at "editor" → back to the editor route.
  useEffect(() => {
    if (step === "editor") router.push(`/editor/${cardId}`);
  }, [step, cardId, router]);

  if (editingCardId !== cardId) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-sm text-[var(--muted)]">Open this page from the editor via &quot;Add tracks&quot;.</p>
          <button
            onClick={() => router.push(`/editor/${cardId}`)}
            className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors"
          >
            ← Back to editor
          </button>
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
    </AppShell>
  );
}
