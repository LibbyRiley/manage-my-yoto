import { urlToYotoIcon } from "./image-processing";
import type { YotoIcon } from "@/types";

interface ScrapedIcon {
  id: string;
  title: string;
  pack: string;
  category: string;
  downloads: number;
}

// Parse icons from the onclick="populate_icon_modal(...)" attributes
function parseIcons(html: string): ScrapedIcon[] {
  const re = /populate_icon_modal\('(\d+)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'(\d+)'\)/g;
  const icons: ScrapedIcon[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    icons.push({
      id: m[1],
      category: m[2],
      title: m[3],
      pack: m[4],
      downloads: parseInt(m[6], 10),
    });
  }
  return icons.sort((a, b) => b.downloads - a.downloads);
}

export async function searchYotoIconsCom(query: string, maxResults = 12): Promise<YotoIcon[]> {
  const res = await fetch(
    `https://yotoicons.com/icons?tag=${encodeURIComponent(query)}`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!res.ok) return [];

  const html = await res.text();
  const scraped = parseIcons(html).slice(0, maxResults);

  const results = await Promise.all(
    scraped.map(async (icon): Promise<YotoIcon | null> => {
      const imageUrl = `https://yotoicons.com/static/uploads/${icon.id}.png`;
      try {
        const buf = await urlToYotoIcon(imageUrl);
        return {
          id: `yotoicons-${icon.id}`,
          source: "yotoicons-com",
          title: icon.title || icon.pack || query,
          tags: [icon.category, icon.pack].filter(Boolean),
          url: imageUrl,
          previewDataUrl: `data:image/png;base64,${buf.toString("base64")}`,
          reason: icon.pack || icon.category || undefined,
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is YotoIcon => r !== null);
}
