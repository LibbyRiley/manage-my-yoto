export type PodcastUrlSource = "apple" | "rss";

const APPLE_HOSTS = ["podcasts.apple.com", "itunes.apple.com"];
const APPLE_ID_RE = /\/id(\d+)/;

/** Detects the kind of URL the user pasted into the RSS field. */
export function detectPodcastUrl(url: string): PodcastUrlSource {
  try {
    const u = new URL(url.trim());
    if (APPLE_HOSTS.includes(u.hostname) && APPLE_ID_RE.test(u.pathname)) return "apple";
  } catch {
    // not a URL — treat as feed URL string and let the loader fail naturally
  }
  return "rss";
}

export function extractApplePodcastId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const match = u.pathname.match(APPLE_ID_RE);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
