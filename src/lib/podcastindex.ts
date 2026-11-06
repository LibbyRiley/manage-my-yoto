import crypto from "crypto";
import type { Podcast } from "@/types";

function getAuthHeaders(): Record<string, string> {
  const apiKey = process.env.PODCASTINDEX_API_KEY;
  const apiSecret = process.env.PODCASTINDEX_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("PodcastIndex API credentials not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const authHash = crypto
    .createHash("sha1")
    .update(apiKey + apiSecret + now)
    .digest("hex");

  return {
    "X-Auth-Key": apiKey,
    "X-Auth-Date": String(now),
    Authorization: authHash,
    "User-Agent": "PodcastToYoto/1.0",
  };
}

export async function searchPodcasts(query: string): Promise<Podcast[]> {
  const url = new URL("https://api.podcastindex.org/api/1.0/search/byterm");
  url.searchParams.set("q", query);
  url.searchParams.set("max", "10");

  const res = await fetch(url.toString(), { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error(`PodcastIndex search failed: ${res.status}`);
  }

  const data = await res.json();
  return (data.feeds || []).map(
    (feed: {
      id: number;
      title: string;
      author: string;
      description: string;
      artwork: string;
      image: string;
      url: string;
      episodeCount: number;
    }) => ({
      id: String(feed.id),
      title: feed.title,
      author: feed.author || "Unknown",
      description: feed.description || "",
      artworkUrl: feed.artwork || feed.image || "",
      feedUrl: feed.url,
      episodeCount: feed.episodeCount || 0,
    })
  );
}
