"use client";

import { AppShell } from "@/components/AppShell";
import { ConnectYoto } from "@/components/ConnectYoto";

export default function Home() {
  return (
    <AppShell>
      <ConnectYoto />
    </AppShell>
  );
}
