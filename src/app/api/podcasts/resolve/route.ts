import { NextRequest, NextResponse } from "next/server";
import { detectPodcastUrl, extractApplePodcastId } from "@/lib/url-resolvers";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url param required" }, { status: 400 });

  const source = detectPodcastUrl(url);
  if (source === "rss") {
    return NextResponse.json({ feedUrl: url, source: "rss" });
  }

  if (source === "apple") {
    try {
      const id = extractApplePodcastId(url);
      if (!id) return NextResponse.json({ error: "Could not parse Apple Podcasts URL" }, { status: 400 });

      const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=podcast`, {
        headers: { "User-Agent": "PodcastToYoto/1.0" },
      });
      if (!lookupRes.ok) {
        return NextResponse.json({ error: `Apple lookup failed: ${lookupRes.status}` }, { status: 502 });
      }
      const data = await lookupRes.json() as { results?: Array<{ feedUrl?: string; collectionName?: string }> };
      const feedUrl = data.results?.[0]?.feedUrl;
      if (!feedUrl) {
        return NextResponse.json({ error: "Could not find that podcast on Apple." }, { status: 404 });
      }
      return NextResponse.json({ feedUrl, source: "apple", confidence: "exact" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Resolve failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: `Unsupported URL type: ${source}` }, { status: 400 });
}
