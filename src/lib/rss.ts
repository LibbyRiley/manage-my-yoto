import Parser from "rss-parser";
import type { Episode } from "@/types";

const parser = new Parser({
  customFields: {
    item: [
      ["itunes:image", "itunesImage", { keepArray: false }],
      ["itunes:duration", "itunesDuration"],
    ],
  },
});

export interface FeedMeta {
  title: string;
  author: string;
  artworkUrl: string;
  description: string;
}

export async function parseRssFeed(feedUrl: string): Promise<{ episodes: Episode[]; meta: FeedMeta }> {
  const feed = await parser.parseURL(feedUrl);

  const feedImage = (feed as { itunes?: { image?: string } }).itunes?.image || feed.image?.url || "";

  const meta: FeedMeta = {
    title: feed.title || "",
    author: (feed as { itunes?: { author?: string } }).itunes?.author || feed.creator || "",
    artworkUrl: feedImage,
    description: feed.description || (feed as { itunes?: { summary?: string } }).itunes?.summary || "",
  };

  const episodes = (feed.items || []).map((item) => {
    const itunesImage = item.itunesImage as
      | { $?: { href?: string } }
      | undefined;
    const artworkUrl = itunesImage?.$?.href || undefined;

    return {
      guid: item.guid || item.link || item.title || "",
      title: item.title || "Untitled Episode",
      description: item.contentSnippet || item.content || "",
      pubDate: item.pubDate || "",
      duration: (item as { itunesDuration?: string }).itunesDuration || "",
      audioUrl: item.enclosure?.url || "",
      artworkUrl,
      selected: false,
    };
  });

  return { episodes, meta };
}
