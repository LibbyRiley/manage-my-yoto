import { urlToYotoIcon } from "./image-processing";
import { extractKeywords } from "./keywords";
import type { YotoIcon } from "@/types";

// Theme groups: any trigger keyword expands to the full emoji set
const THEMES: Array<{ triggers: string[]; emojis: string[] }> = [
  {
    triggers: ["space", "rocket", "planet", "astronaut", "galaxy", "cosmos", "orbit", "nasa", "alien", "ufo"],
    emojis: ["🚀", "🪐", "⭐", "🌙", "☀️", "☄️", "🌌", "👽", "🛸", "🔭"],
  },
  {
    triggers: ["ocean", "sea", "underwater", "dive", "marine", "beach", "coral", "reef"],
    emojis: ["🌊", "🐋", "🦈", "🐬", "🐙", "🐚", "🦀", "🐟", "⛵", "🏖️"],
  },
  {
    triggers: ["forest", "jungle", "wild", "nature", "woods", "rainforest"],
    emojis: ["🌲", "🌿", "🦁", "🐺", "🦌", "🐒", "🍄", "🌳", "🌴", "🦜"],
  },
  {
    triggers: ["dinosaur", "dino", "prehistoric", "fossil", "jurassic", "raptor", "t-rex"],
    emojis: ["🦕", "🦖", "🥚", "🌋", "🏔️", "🦴", "🔬"],
  },
  {
    triggers: ["magic", "wizard", "witch", "spell", "enchanted", "sorcerer", "wand", "fairy", "potion"],
    emojis: ["✨", "🧙", "🧚", "🪄", "🔮", "⚗️", "🌟", "🦄", "🏰", "🗝️"],
  },
  {
    triggers: ["pirate", "treasure", "adventure", "quest", "explore", "map", "voyage", "captain"],
    emojis: ["🏴‍☠️", "⚓", "🗺️", "💎", "⚔️", "🦜", "🌊", "🏝️", "🧭", "🔱"],
  },
  {
    triggers: ["superhero", "hero", "power", "villain", "comic", "cape"],
    emojis: ["🦸", "⚡", "💥", "🛡️", "🦾", "👊", "🌟", "🦹"],
  },
  {
    triggers: ["robot", "science", "tech", "invention", "laboratory", "experiment", "engineering"],
    emojis: ["🤖", "🔬", "🧪", "💡", "⚙️", "🔭", "💻", "🛰️", "🧬"],
  },
  {
    triggers: ["ghost", "halloween", "spooky", "haunted", "monster", "zombie", "vampire", "skeleton", "scary"],
    emojis: ["👻", "🎃", "🧟", "🧛", "💀", "🕷️", "🦇", "🌑", "⚰️"],
  },
  {
    triggers: ["christmas", "santa", "xmas", "festive", "holiday", "gifts"],
    emojis: ["🎄", "🎅", "🎁", "⛄", "❄️", "🦌", "🔔", "🌟"],
  },
  {
    triggers: ["music", "song", "sing", "band", "concert", "rock", "pop", "dance"],
    emojis: ["🎵", "🎤", "🎸", "🥁", "🎹", "🎺", "🎻", "🎶", "🎼"],
  },
  {
    triggers: ["sport", "game", "football", "soccer", "basketball", "tennis", "baseball", "olympics", "race"],
    emojis: ["⚽", "🏆", "🥇", "🏈", "🏀", "🎾", "⚾", "🏅", "🎽", "🏋️"],
  },
  {
    triggers: ["farm", "farming", "countryside", "harvest", "barn"],
    emojis: ["🐄", "🐖", "🐔", "🐑", "🌽", "🥕", "🚜", "🌻", "🏡"],
  },
  {
    triggers: ["princess", "castle", "kingdom", "royal", "queen", "king", "prince", "dragon"],
    emojis: ["👸", "🏰", "🐲", "👑", "⚔️", "🗡️", "🌹", "🦄"],
  },
];

// Direct 1:1 fallback for keywords not covered by themes
const KEYWORD_EMOJI: Record<string, string> = {
  cat: "🐱", dog: "🐶", bear: "🐻", lion: "🦁", tiger: "🐯",
  elephant: "🐘", monkey: "🐒", rabbit: "🐰", fox: "🦊", wolf: "🐺",
  horse: "🐴", cow: "🐮", pig: "🐷", chicken: "🐔", bird: "🐦",
  fish: "🐟", shark: "🦈", whale: "🐋", dolphin: "🐬", frog: "🐸",
  snake: "🐍", owl: "🦉", penguin: "🐧", turtle: "🐢", bee: "🐝", butterfly: "🦋",
  star: "⭐", moon: "🌙", sun: "☀️", comet: "☄️",
  car: "🚗", truck: "🚚", train: "🚂", plane: "✈️",
  boat: "⛵", bus: "🚌", bike: "🚲", ship: "🚢", helicopter: "🚁",
  tree: "🌲", flower: "🌸", rain: "🌧️", snow: "❄️", fire: "🔥",
  water: "💧", mountain: "⛰️", volcano: "🌋", rainbow: "🌈", desert: "🏜️", island: "🏝️",
  pizza: "🍕", cake: "🎂", cookie: "🍪", candy: "🍬", apple: "🍎", burger: "🍔", ice: "🍦",
  sword: "⚔️", knight: "⚔️", ghost: "👻",
  fun: "🎉", party: "🎊", birthday: "🎂", gift: "🎁",
  story: "📚", book: "📖", school: "🏫", art: "🎨", craft: "✂️",
  happy: "😊", laugh: "😂", love: "❤️", friend: "👫", family: "👨‍👩‍👧",
  baby: "👶", kid: "🧒", girl: "👧", boy: "👦",
  easter: "🐣", summer: "☀️", winter: "❄️", autumn: "🍂", spring: "🌸",
};

function emojiCodepoint(emoji: string): string {
  return [...emoji]
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((cp) => cp !== "fe0f") // strip variation selector
    .join("-");
}

function twemojiUrl(emoji: string): string {
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${emojiCodepoint(emoji)}.png`;
}

export async function generateEmojiIcons(
  episodeTitle: string,
  maxResults = 8
): Promise<YotoIcon[]> {
  const keywords = extractKeywords(episodeTitle);

  const seen = new Set<string>();
  const matches: { emoji: string; keyword: string }[] = [];

  for (const kw of keywords) {
    // Check themes first — expand to full set
    const theme = THEMES.find((t) => t.triggers.includes(kw));
    if (theme) {
      for (const emoji of theme.emojis) {
        if (!seen.has(emoji)) {
          seen.add(emoji);
          matches.push({ emoji, keyword: kw });
        }
      }
      continue;
    }
    // Fall back to direct 1:1 mapping
    const emoji = KEYWORD_EMOJI[kw];
    if (emoji && !seen.has(emoji)) {
      seen.add(emoji);
      matches.push({ emoji, keyword: kw });
    }
  }

  const results = await Promise.all(
    matches.slice(0, maxResults).map(async ({ emoji, keyword }) => {
      try {
        const iconBuffer = await urlToYotoIcon(twemojiUrl(emoji));
        return {
          id: `emoji-${emojiCodepoint(emoji)}`,
          source: "emoji" as const,
          title: emoji,
          tags: [],
          url: twemojiUrl(emoji),
          previewDataUrl: `data:image/png;base64,${iconBuffer.toString("base64")}`,
          reason: `keyword: ${keyword}`,
        } satisfies YotoIcon;
      } catch {
        return null;
      }
    })
  );

  return results.filter((r) => r !== null) as YotoIcon[];
}
