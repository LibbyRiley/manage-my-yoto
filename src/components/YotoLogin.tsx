"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";

export function YotoLogin() {
  const { setYotoLoggedIn, setStep } = useAppStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/yoto/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setYotoLoggedIn(true);
      setStep("icons");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Log in to Yoto</h2>
          <p className="text-sm text-[var(--muted)]">
            Required to search the Yoto icon library and upload episodes
          </p>
        </div>
        <button
          onClick={() => setStep("episodes")}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          ← Back
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-sm space-y-4 p-6 bg-[var(--card)] border border-[var(--border)] rounded-lg"
      >
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 pr-10 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-xs px-1"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>

        <p className="text-xs text-[var(--muted)]">
          Your credentials are only sent to Yoto&apos;s servers and are not
          stored.
        </p>
      </form>
    </div>
  );
}
