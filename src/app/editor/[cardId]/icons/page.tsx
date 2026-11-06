"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { IconPicker } from "@/components/IconPicker";

export default function BulkIconsPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const router = useRouter();
  const step = useAppStore((s) => s.step);
  const editingAllTrackIcons = useAppStore((s) => s.editingAllTrackIcons);

  useEffect(() => {
    if (step === "editor") router.push(`/editor/${cardId}`);
  }, [step, cardId, router]);

  return (
    <AppShell>
      {editingAllTrackIcons ? (
        <IconPicker />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-sm text-[var(--muted)]">Open this page from the editor via the &quot;Edit all icons&quot; menu.</p>
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
