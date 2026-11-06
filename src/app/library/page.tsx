"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { YotoLibrary } from "@/components/YotoLibrary";

export default function LibraryPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/yoto/status")
      .then((r) => r.json())
      .then((d) => {
        if (!d.connected) router.replace("/");
        else setChecking(false);
      })
      .catch(() => router.replace("/"));
  }, [router]);

  return (
    <AppShell>
      {checking ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <YotoLibrary />
      )}
    </AppShell>
  );
}
