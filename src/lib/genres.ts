/** Canonical genres: chains and TMDB use different Hebrew words; the site uses one vocabulary. */
export const GENRES: { key: string; label: string }[] = [
  { key: "action", label: "פעולה" },
  { key: "adventure", label: "הרפתקאות" },
  { key: "animation", label: "אנימציה" },
  { key: "biography", label: "ביוגרפיה" },
  { key: "comedy", label: "קומדיה" },
  { key: "crime", label: "פשע" },
  { key: "documentary", label: "דוקומנטרי" },
  { key: "drama", label: "דרמה" },
  { key: "family", label: "לכל המשפחה" },
  { key: "fantasy", label: "פנטזיה" },
  { key: "history", label: "היסטוריה" },
  { key: "horror", label: "אימה" },
  { key: "israeli", label: "ישראלי" },
  { key: "music", label: "מוזיקה" },
  { key: "mystery", label: "מסתורין" },
  { key: "romance", label: "רומנטי" },
  { key: "scifi", label: "מדע בדיוני" },
  { key: "thriller", label: "מתח" },
  { key: "war", label: "מלחמה" },
  { key: "western", label: "מערבון" },
  { key: "classic", label: "קלאסיקה" },
];
const LABEL = new Map(GENRES.map((g) => [g.key, g.label]));
const ORDER = new Map(GENRES.map((g, i) => [g.key, i]));

const SYNONYMS: Record<string, string[]> = {
  "אקשן": ["action"], "פעולה": ["action"], "גיבורי על": ["action", "fantasy"],
  "הרפתקאות": ["adventure"], "אנימציה": ["animation"], "ביוגרפיה": ["biography"],
  "קומדיה": ["comedy"], "קומדיה רומנטית": ["comedy", "romance"], "קומדיה שחורה": ["comedy"],
  "פשע": ["crime"], "דוקומנטרי": ["documentary"], "תיעודי": ["documentary"],
  "דרמה": ["drama"], "דרמה תקופתית": ["drama", "history"], "דרמה מוזיקלית": ["drama", "music"], "קולנוע אפי": ["drama"],
  "לכל המשפחה": ["family"], "משפחה": ["family"], "ילדים": ["family"],
  "פנטזיה": ["fantasy"], "היסטוריה": ["history"], "אימה": ["horror"], "ישראלי": ["israeli"],
  "מוזיקה": ["music"], "מחזמר": ["music"], "מוסיקה": ["music"],
  "מסתורין": ["mystery"], "רומנטי": ["romance"], "רומנטיקה": ["romance"],
  // TMDB's own Hebrew is not the chains': it says "מותחן" for thriller and misspells history
  "מדע בדיוני": ["scifi"], "מתח": ["thriller"], "מותחן": ["thriller"], "הסטוריה": ["history"],
  "מלחמה": ["war"], "מערבון": ["western"],
  "קלאסיקה": ["classic"], "קלאסיק": ["classic"], "קלאסי": ["classic"],
};

/** Raw genre words from any source -> canonical keys, ordered. */
export function canonicalGenres(raw: string[], isIsraeli = false): string[] {
  const keys = new Set<string>();
  for (const r of raw) {
    const w = r.trim();
    const hit = SYNONYMS[w] ?? SYNONYMS[w.replace(/^סרטי?\s+/, "")];
    if (hit) for (const k of hit) keys.add(k);
  }
  if (isIsraeli) keys.add("israeli");
  return [...keys].sort((a, b) => (ORDER.get(a) ?? 99) - (ORDER.get(b) ?? 99));
}
export const genreLabel = (key: string) => LABEL.get(key) ?? key;
