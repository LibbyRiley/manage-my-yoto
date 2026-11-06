const STOP_WORDS = new Set([
  "episode", "ep", "part", "pt", "the", "a", "an", "and", "or", "but",
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "is", "it",
  "this", "that", "are", "was", "be", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "shall", "can",
  "not", "no", "so", "if", "then", "than", "too", "very", "just", "about",
  "up", "out", "how", "what", "when", "where", "who", "why", "which",
  "new", "all", "each", "every", "both", "few", "more", "most", "other",
  "some", "such", "only", "own", "same", "also", "back", "get", "got",
  "bonus", "special", "trailer", "preview", "rerun", "encore", "live",
  "season", "series", "vol", "volume", "chapter", "show", "podcast",
]);

export function extractKeywords(title: string): string[] {
  const cleaned = title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ");

  return words.filter(
    (word) => word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)
  );
}
