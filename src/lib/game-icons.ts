import sharp from "sharp";
import { extractKeywords } from "./keywords";
import type { YotoIcon } from "@/types";

function svgUrl(author: string, name: string) {
  return `https://game-icons.net/icons/${author}/originals/svg/${name}.svg`;
}

interface IconDef {
  author: string;
  name: string;
}

interface Theme {
  triggers: string[];
  icons: IconDef[];
  bg: string;
}

const THEMES: Theme[] = [
  {
    triggers: ["dragon", "fantasy", "knight", "medieval", "quest", "legend", "myth", "castle"],
    icons: [
      { author: "lorc", name: "dragon" },
      { author: "lorc", name: "sword" },
      { author: "lorc", name: "shield" },
      { author: "lorc", name: "castle" },
      { author: "lorc", name: "crown" },
    ],
    bg: "#5c1010",
  },
  {
    triggers: ["space", "rocket", "planet", "astronaut", "galaxy", "star", "universe", "cosmos", "nasa", "orbit"],
    icons: [
      { author: "delapouite", name: "rocket" },
      { author: "delapouite", name: "astronaut-helmet" },
      { author: "lorc", name: "ringed-planet" },
      { author: "lorc", name: "star-swirl" },
      { author: "lorc", name: "lunar-module" },
    ],
    bg: "#0a1530",
  },
  {
    triggers: ["ocean", "sea", "underwater", "marine", "pirate", "ship", "treasure", "beach"],
    icons: [
      { author: "lorc", name: "shark" },
      { author: "lorc", name: "whale" },
      { author: "lorc", name: "octopus" },
      { author: "lorc", name: "pirate-flag" },
      { author: "lorc", name: "anchor" },
    ],
    bg: "#082840",
  },
  {
    triggers: ["forest", "jungle", "wild", "nature", "woods", "animal", "wildlife"],
    icons: [
      { author: "lorc", name: "wolf-head" },
      { author: "lorc", name: "fox" },
      { author: "lorc", name: "owl" },
      { author: "lorc", name: "bear" },
      { author: "lorc", name: "mushroom" },
    ],
    bg: "#0f2e0a",
  },
  {
    triggers: ["dinosaur", "dino", "prehistoric", "fossil", "jurassic", "raptor", "rex"],
    icons: [
      { author: "lorc", name: "stegosaurus" },
      { author: "lorc", name: "triceratops" },
      { author: "lorc", name: "diplodocus" },
      { author: "delapouite", name: "dinosaur-rex" },
      { author: "lorc", name: "egg" },
    ],
    bg: "#1e3a05",
  },
  {
    triggers: ["magic", "wizard", "witch", "spell", "enchanted", "potion", "sorcerer", "wand", "fairy"],
    icons: [
      { author: "lorc", name: "crystal-ball" },
      { author: "lorc", name: "magic-swirl" },
      { author: "lorc", name: "witch-flight" },
      { author: "lorc", name: "cauldron" },
      { author: "lorc", name: "scroll-unfurled" },
    ],
    bg: "#250a40",
  },
  {
    triggers: ["ghost", "halloween", "spooky", "haunted", "monster", "zombie", "vampire", "skeleton", "skull", "scary"],
    icons: [
      { author: "lorc", name: "skull" },
      { author: "lorc", name: "ghost" },
      { author: "lorc", name: "bat" },
      { author: "lorc", name: "tombstone" },
      { author: "lorc", name: "spider-web" },
    ],
    bg: "#150520",
  },
  {
    triggers: ["music", "song", "sing", "band", "concert", "dance", "rhythm", "rock", "pop"],
    icons: [
      { author: "lorc", name: "musical-notes" },
      { author: "delapouite", name: "guitar" },
      { author: "lorc", name: "drum" },
      { author: "delapouite", name: "microphone" },
      { author: "delapouite", name: "vinyl" },
    ],
    bg: "#2a004a",
  },
  {
    triggers: ["robot", "science", "tech", "invention", "laboratory", "experiment", "engineering", "machine"],
    icons: [
      { author: "lorc", name: "android-mask" },
      { author: "lorc", name: "cog" },
      { author: "delapouite", name: "test-tube" },
      { author: "delapouite", name: "microscope" },
      { author: "lorc", name: "atom" },
    ],
    bg: "#0a2a2a",
  },
  {
    triggers: ["adventure", "explore", "quest", "journey", "map", "voyage", "captain", "expedition"],
    icons: [
      { author: "delapouite", name: "treasure-map" },
      { author: "lorc", name: "compass" },
      { author: "lorc", name: "open-treasure-chest" },
      { author: "delapouite", name: "binoculars" },
      { author: "lorc", name: "path-distance" },
    ],
    bg: "#3a1a00",
  },
  {
    triggers: ["sport", "game", "race", "champion", "athlete", "competition", "soccer", "football", "basketball"],
    icons: [
      { author: "delapouite", name: "trophy" },
      { author: "delapouite", name: "medal" },
      { author: "delapouite", name: "soccer-ball" },
      { author: "delapouite", name: "basketball" },
      { author: "delapouite", name: "running-ninja" },
    ],
    bg: "#3a0a0a",
  },
  {
    triggers: ["food", "cooking", "baking", "cake", "eat", "chef", "recipe", "kitchen", "hungry"],
    icons: [
      { author: "delapouite", name: "cupcake" },
      { author: "delapouite", name: "hot-meal" },
      { author: "delapouite", name: "pizza-slice" },
      { author: "lorc", name: "cooking-pot" },
      { author: "delapouite", name: "apple" },
    ],
    bg: "#3a1020",
  },
  {
    triggers: ["christmas", "santa", "holiday", "winter", "snow", "festive", "gift", "xmas"],
    icons: [
      { author: "delapouite", name: "christmas-tree" },
      { author: "lorc", name: "snowflake" },
      { author: "delapouite", name: "gift" },
      { author: "lorc", name: "deer" },
      { author: "lorc", name: "star-swirl" },
    ],
    bg: "#0a1a3a",
  },
  {
    triggers: ["superhero", "hero", "power", "villain", "comic", "cape", "strength"],
    icons: [
      { author: "lorc", name: "cape" },
      { author: "lorc", name: "lightning-bolt" },
      { author: "lorc", name: "fist" },
      { author: "delapouite", name: "domino-mask" },
      { author: "lorc", name: "shield" },
    ],
    bg: "#1a0a40",
  },
  {
    triggers: ["farm", "farming", "countryside", "harvest", "barn", "tractor"],
    icons: [
      { author: "delapouite", name: "tractor" },
      { author: "lorc", name: "cow" },
      { author: "lorc", name: "chicken-leg" },
      { author: "delapouite", name: "barn" },
      { author: "lorc", name: "wheat" },
    ],
    bg: "#3a2800",
  },
];

const KEYWORD_ICONS: Record<string, IconDef> = {
  dragon:    { author: "lorc",       name: "dragon" },
  wolf:      { author: "lorc",       name: "wolf-head" },
  bear:      { author: "lorc",       name: "bear" },
  horse:     { author: "delapouite", name: "horse" },
  elephant:  { author: "delapouite", name: "elephant" },
  owl:       { author: "lorc",       name: "owl" },
  fox:       { author: "lorc",       name: "fox" },
  rabbit:    { author: "lorc",       name: "rabbit" },
  fish:      { author: "lorc",       name: "fish" },
  shark:     { author: "lorc",       name: "shark" },
  whale:     { author: "lorc",       name: "whale" },
  octopus:   { author: "lorc",       name: "octopus" },
  bee:       { author: "lorc",       name: "bee" },
  butterfly: { author: "lorc",       name: "butterfly" },
  snake:     { author: "lorc",       name: "snake" },
  sword:     { author: "lorc",       name: "sword" },
  shield:    { author: "lorc",       name: "shield" },
  skull:     { author: "lorc",       name: "skull" },
  fire:      { author: "lorc",       name: "fire-symbol" },
  star:      { author: "lorc",       name: "star-swirl" },
  moon:      { author: "lorc",       name: "crescent-blade" },
  key:       { author: "lorc",       name: "key" },
  book:      { author: "delapouite", name: "book-cover" },
  scroll:    { author: "lorc",       name: "scroll-unfurled" },
  gem:       { author: "lorc",       name: "gem" },
  crown:     { author: "lorc",       name: "crown" },
  hammer:    { author: "lorc",       name: "war-pick" },
  axe:       { author: "lorc",       name: "battle-axe" },
  rocket:    { author: "delapouite", name: "rocket" },
  anchor:    { author: "lorc",       name: "anchor" },
  compass:   { author: "lorc",       name: "compass" },
  tree:      { author: "lorc",       name: "pine-tree" },
  mushroom:  { author: "lorc",       name: "mushroom" },
  flower:    { author: "lorc",       name: "lotus-flower" },
  castle:    { author: "lorc",       name: "castle" },
  map:       { author: "delapouite", name: "treasure-map" },
  trophy:    { author: "delapouite", name: "trophy" },
  cake:      { author: "delapouite", name: "cupcake" },
  pizza:     { author: "delapouite", name: "pizza-slice" },
  apple:     { author: "delapouite", name: "apple" },
  gift:      { author: "delapouite", name: "gift" },
  snowflake: { author: "lorc",       name: "snowflake" },
  ghost:     { author: "lorc",       name: "ghost" },
  bat:       { author: "lorc",       name: "bat" },
  robot:     { author: "lorc",       name: "android-mask" },
  atom:      { author: "lorc",       name: "atom" },
  guitar:    { author: "delapouite", name: "guitar" },
  drum:      { author: "lorc",       name: "drum" },
};

async function colorizeAndConvert(svgText: string, bg: string): Promise<Buffer> {
  // Add a background rect as first child, set all drawn elements to white
  const colorized = svgText
    .replace(
      /(<svg[^>]*>)/,
      `$1<rect width="100%" height="100%" fill="${bg}"/>`
    )
    .replace(/fill="[^"]*"/g, 'fill="#ffffff"')
    .replace(/fill:#[0-9a-fA-F]+/g, "fill:#ffffff")
    .replace(/fill:black/g, "fill:#ffffff")
    .replace(/fill:rgb\([^)]+\)/g, "fill:#ffffff");

  return sharp(Buffer.from(colorized))
    .resize(16, 16, { fit: "contain", background: bg })
    .flatten({ background: bg })
    .png()
    .toBuffer();
}

async function fetchAndConvert(
  def: IconDef,
  bg: string,
  keyword: string
): Promise<YotoIcon | null> {
  const url = svgUrl(def.author, def.name);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[game-icons] 404: ${url}`);
      return null;
    }
    const svgText = await res.text();
    if (!svgText.includes("<svg")) {
      console.warn(`[game-icons] no <svg in response: ${url}`);
      return null;
    }
    const iconBuffer = await colorizeAndConvert(svgText, bg);
    return {
      id: `game-icon-${def.author}-${def.name}`,
      source: "game-icons" as YotoIcon["source"],
      title: def.name.replace(/-/g, " "),
      tags: [keyword],
      url: "",
      previewDataUrl: `data:image/png;base64,${iconBuffer.toString("base64")}`,
      reason: `game icon: ${keyword}`,
    };
  } catch (err) {
    console.warn(`[game-icons] error for ${url}:`, err);
    return null;
  }
}

export async function generateGameIcons(
  episodeTitle: string,
  maxResults = 6
): Promise<YotoIcon[]> {
  const keywords = extractKeywords(episodeTitle);
  const seen = new Set<string>();
  const jobs: Array<{ def: IconDef; bg: string; keyword: string }> = [];

  for (const kw of keywords) {
    const theme = THEMES.find((t) => t.triggers.includes(kw));
    if (theme) {
      for (const icon of theme.icons) {
        const id = `${icon.author}/${icon.name}`;
        if (!seen.has(id)) {
          seen.add(id);
          jobs.push({ def: icon, bg: theme.bg, keyword: kw });
        }
      }
      continue;
    }
    const icon = KEYWORD_ICONS[kw];
    if (icon) {
      const id = `${icon.author}/${icon.name}`;
      if (!seen.has(id)) {
        seen.add(id);
        jobs.push({ def: icon, bg: "#1a1a2e", keyword: kw });
      }
    }
  }

  const results = await Promise.all(
    jobs.slice(0, maxResults).map(({ def, bg, keyword }) =>
      fetchAndConvert(def, bg, keyword)
    )
  );

  return results.filter((r): r is YotoIcon => r !== null);
}
