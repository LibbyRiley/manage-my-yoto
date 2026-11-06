"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { IconPicker } from "@/components/IconPicker";

export default function SingleTrackIconPage() {
  const { cardId } = useParams<{ cardId: string; trackId: string }>();
  const router = useRouter();
  const step = useAppStore((s) => s.step);
  const editingTrackKey = useAppStore((s) => s.editingTrackKey);

  // IconPicker uses setStep("editor") to signal it's done (save or back).
  // Translate that into a URL push so we land on the editor route.
  useEffect(() => {
    if (step === "editor") router.push(`/editor/${cardId}`);
  }, [step, cardId, router]);

  return (
    <AppShell>
      {editingTrackKey ? (
        <IconPicker />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-sm text-[var(--muted)]">Open this page from the editor by clicking a track&apos;s icon.</p>
          <button
            onClick={() => router.push(`/editor/${cardId}`)}
            className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors"
          >
            ← Back to editor
          </button>
        </div>
      )}
    </AppShell>
  );
}
