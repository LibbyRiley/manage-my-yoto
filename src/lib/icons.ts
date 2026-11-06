import { extractKeywords } from "./keywords";
import { urlToYotoIcon } from "./image-processing";
import { getYotoToken } from "./yoto-session";
import { generateEmojiIcons } from "./emoji";
import type { YotoIcon } from "@/types";

interface YotoPublicIcon {
  displayIconId: string;
  mediaId: string;
  title: string;
  url: string;
  publicTags: string[];
}

let cachedLibrary: YotoPublicIcon[] | null = null;

async function fetchYotoIconLibrary(): Promise<YotoPublicIcon[]> {
  if (cachedLibrary) return cachedLibrary;

  const token = getYotoToken();
  if (!token) return [];

  const res = await fetch(
    "https://api.yotoplay.com/media/displayIcons/user/yoto",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Yoto icon library: ${res.status}`);
  }

  const data = await res.json();
  cachedLibrary = data.displayIcons || [];
  return cachedLibrary!;
}

function scoreIconMatch(icon: YotoPublicIcon, keywords: string[]): number {
  let score = 0;
  const titleLower = (icon.title ?? "").toLowerCase();
  const tagsLower = (icon.publicTags ?? []).filter(Boolean).map((t) => t.toLowerCase());

  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) score += 3;
    for (const tag of tagsLower) {
      if (tag === keyword) score += 5;
      else if (tag.includes(keyword) || keyword.includes(tag)) score += 2;
    }
  }

  return score;
}

export async function searchYotoLibraryByKeywords(
  keywords: string[],
  maxResults = 3
): Promise<YotoIcon[]> {
  const library = await fetchYotoIconLibrary();

  if (keywords.length === 0) return [];

  const scored = library
    .map((icon) => ({ icon, score: scoreIconMatch(icon, keywords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return scored.map(({ icon }) => ({
    id: icon.mediaId,
    source: "yoto-library" as const,
    title: icon.title ?? "",
    tags: (icon.publicTags ?? []).filter(Boolean),
    url: icon.url ?? "",
  }));
}

export async function searchYotoLibrary(
  episodeTitle: string,
  maxResults = 3
): Promise<YotoIcon[]> {
  const keywords = extractKeywords(episodeTitle);
  return searchYotoLibraryByKeywords(keywords, maxResults);
}

export async function generateArtworkIcon(
  artworkUrl: string
): Promise<YotoIcon | null> {
  if (!artworkUrl) return null;

  try {
    const iconBuffer = await urlToYotoIcon(artworkUrl);
    const dataUrl = `data:image/png;base64,${iconBuffer.toString("base64")}`;

    return {
      id: `artwork-${Date.now()}`,
      source: "artwork-downscale",
      title: "Downscaled artwork",
      tags: [],
      url: "",
      previewDataUrl: dataUrl,
      reason: "episode artwork downscaled to 16×16",
    };
  } catch {
    return null;
  }
}

export async function generateAiIcons(
  episodeTitle: string,
  count = 2
): Promise<YotoIcon[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });

  const keywords = extractKeywords(episodeTitle);
  const topic = keywords.slice(0, 4).join(", ");

  const icons: YotoIcon[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: [
          "A single 16x16 pixel art icon on a transparent background.",
          `Subject: ${topic}.`,
          "Style: simple, colorful, child-friendly pixel art.",
          "Bright saturated colors. No text. No black pixels.",
          "Retro game sprite aesthetic.",
        ].join(" "),
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) continue;

      const iconBuffer = await urlToYotoIcon(imageUrl);
      const dataUrl = `data:image/png;base64,${iconBuffer.toString("base64")}`;

      icons.push({
        id: `ai-${Date.now()}-${i}`,
        source: "ai-generated",
        title: `AI: ${topic}`,
        tags: keywords,
        url: "",
        previewDataUrl: dataUrl,
        reason: `AI generated from: ${topic}`,
      });
    } catch {
      continue;
    }
  }

  return icons;
}

export async function findIconsForEpisode(
  episodeTitle: string,
  artworkUrl?: string,
): Promise<YotoIcon[]> {
  const [libraryIcons, artworkIcon, aiIcons, emojiIcons] = await Promise.all([
    searchYotoLibrary(episodeTitle, 3),
    generateArtworkIcon(artworkUrl || ""),
    generateAiIcons(episodeTitle, 2),
    generateEmojiIcons(episodeTitle, 8),
  ]);

  const candidates: YotoIcon[] = [...libraryIcons, ...emojiIcons, ...aiIcons];

  if (artworkIcon) {
    candidates.push(artworkIcon);
  }

  return candidates;
}
