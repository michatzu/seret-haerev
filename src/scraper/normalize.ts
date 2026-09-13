/** Unify films across chains and assemble the snapshot. */
import type { AdapterResult, Chain, Film, RawFilm, Screening, Snapshot, SourceReport, Venue } from "@/lib/types";
import { normalizeTitle, shortHash } from "@/lib/text";
import { canonicalGenres, genreLabel } from "@/lib/genres";

const KIDS_GENRES = ["אנימציה", "לכל המשפחה", "ילדים", "משפחה"];
/** Preferred source order for posters and metadata. */
const CHAIN_RANK: Chain[] = ["planet", "ravhen", "movieland", "cinemacity", "hot", "lev", "cinematheque", "other"];
const rank = (c: Chain) => CHAIN_RANK.indexOf(c);

const CYRILLIC = /[Ѐ-ӿ][Ѐ-ӿ\s:!?,.\-–—'"«»]*/g;

/** Title -> grouping key. Learns Cyrillic->Hebrew pairs from mixed titles ("האודיסאה מדובב לרוסית ОДИССЕЯ"). */
function keyer(raws: RawFilm[]) {
  const cyrToKey = new Map<string, string>();
  for (const f of raws) {
    const cyr = f.title.match(CYRILLIC)?.map((s) => s.trim()).filter((s) => s.length > 2) ?? [];
    const hebrewPart = f.title.replace(CYRILLIC, " ").replace(/מדובב\s+לרוסית/g, " ");
    const k = normalizeTitle(hebrewPart);
    if (cyr.length && k.length >= 3) for (const c of cyr) cyrToKey.set(normalizeCyr(c), k);
  }
  return (f: RawFilm): string => {
    let t = f.title.replace(/מדובב\s+ל(רוסית|עברית|אנגלית)/g, " ");
    const cyr = t.match(CYRILLIC)?.map((s) => normalizeCyr(s)) ?? [];
    t = t.replace(CYRILLIC, " ");
    let k = normalizeTitle(t);
    if (k.length < 3 && cyr.length) k = cyr.map((c) => cyrToKey.get(c) ?? c).join(" ");
    return k || f.title.toLowerCase();
  };
}
const normalizeCyr = (s: string) => s.toLowerCase().replace(/[^Ѐ-ӿ]+/g, " ").trim();

/** Loose key for fuzzy merging: no spaces, no leading ה of words, digits kept. */
function looseKey(k: string): string {
  return k
    .split(" ")
    .map((w) => w.replace(/^ה(?=.{2})/, ""))
    .join("")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
function lev1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function buildSnapshot(results: AdapterResult[], reports: SourceReport[]): Snapshot {
  const venueMap = new Map<string, Venue>();
  for (const r of results) for (const v of r.venues) venueMap.set(v.id, v);

  const rawByKey = new Map<string, RawFilm>();
  for (const r of results) for (const f of r.films) rawByKey.set(`${f.chain}:${f.sourceId}`, f);
  const raws = [...rawByKey.values()];
  const keyOf = keyer(raws);

  // 1) exact groups by normalised key
  const groups = new Map<string, RawFilm[]>();
  const keyByRaw = new Map<RawFilm, string>();
  for (const f of raws) {
    const k = f.aliasOfSourceId && rawByKey.has(`${f.chain}:${f.aliasOfSourceId}`) ? keyOf(rawByKey.get(`${f.chain}:${f.aliasOfSourceId}`)!) : keyOf(f);
    keyByRaw.set(f, k);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(f);
  }
  // 2) fuzzy merge of near-identical keys
  const keys = [...groups.keys()];
  const merged = new Map<string, string>(); // key -> canonical key
  const loose = new Map<string, string>();
  for (const k of keys) {
    const lk = looseKey(k);
    let target: string | undefined = loose.get(lk);
    if (!target && lk.length >= 8) for (const [olk, ok] of loose) if (lev1(lk, olk)) { target = ok; break; }
    if (target) merged.set(k, target);
    else loose.set(lk, k);
  }
  const canonicalKey = (k: string) => merged.get(k) ?? k;
  const finalGroups = new Map<string, RawFilm[]>();
  for (const [k, arr] of groups) {
    const ck = canonicalKey(k);
    (finalGroups.get(ck) ?? finalGroups.set(ck, []).get(ck)!).push(...arr);
  }

  // 3) screenings first (kids classification needs them)
  const filmIdByRaw = new Map<RawFilm, string>();
  const idByKey = new Map<string, string>();
  for (const [k, arr] of finalGroups) {
    const id = "f" + shortHash(k);
    idByKey.set(k, id);
    for (const f of arr) filmIdByRaw.set(f, id);
  }
  const screenings: Screening[] = [];
  const seen = new Set<string>();
  const dubbedHeCount = new Map<string, number>();
  const totalCount = new Map<string, number>();
  for (const r of results) {
    for (const s of r.screenings) {
      const raw = rawByKey.get(`${s.chain}:${s.sourceFilmId}`);
      const filmId = raw ? filmIdByRaw.get(raw) : undefined;
      if (!filmId || !venueMap.has(s.venueId)) continue;
      const id = `${s.chain}-${s.sourceId}`;
      if (seen.has(id)) continue;
      seen.add(id);
      let dubbedLang = s.dubbedLang;
      if (!dubbedLang && raw?.aliasOfSourceId) dubbedLang = "ru";
      if (!dubbedLang && raw && /לרוסית|[Ѐ-ӿ]/.test(raw.title)) dubbedLang = "ru";
      const attrs = [...s.attrs];
      if (dubbedLang && !attrs.includes("dubbed")) attrs.push("dubbed");
      if (dubbedLang && attrs.includes("subbed")) attrs.splice(attrs.indexOf("subbed"), 1);
      screenings.push({ id, filmId, venueId: s.venueId, startsAt: s.startsAt, attrs, dubbedLang, hall: s.hall, bookingUrl: s.bookingUrl, soldOut: s.soldOut });
      totalCount.set(filmId, (totalCount.get(filmId) ?? 0) + 1);
      if (dubbedLang === "he") dubbedHeCount.set(filmId, (dubbedHeCount.get(filmId) ?? 0) + 1);
    }
  }
  screenings.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  // 4) films
  const films: Film[] = [];
  for (const [k, arrUnsorted] of finalGroups) {
    const id = idByKey.get(k)!;
    if (!totalCount.get(id)) continue; // no screenings
    const arr = [...arrUnsorted].sort((a, b) => rank(a.chain) - rank(b.chain));
    const pick = <K extends keyof RawFilm>(key: K): RawFilm[K] | undefined =>
      arr.map((f) => f[key]).find((v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0));
    // title: prefer a Hebrew title without dubbing noise, from the best-ranked source
    const cleanTitles = arr.map((f) => cleanTitle(f.title)).filter((t) => t && !/[Ѐ-ӿ]/.test(t));
    const title = (cleanTitles[0] ?? cleanTitle(arr[0].title) ?? arr[0].title).replace(/\s+/g, " ").trim();
    const rawGenres = [...new Set(arr.flatMap((f) => f.genres ?? []))];
    const dubbedShare = (dubbedHeCount.get(id) ?? 0) / (totalCount.get(id) ?? 1);
    const isIsraeli = arr.some((f) => f.isIsraeli) || (pick("language") === "he" && dubbedShare < 0.5);
    const genreKeys = canonicalGenres(rawGenres, isIsraeli);
    const genres = genreKeys.filter((k) => k !== "israeli").map(genreLabel);
    const isKids = dubbedShare >= 0.5 || rawGenres.some((g) => KIDS_GENRES.includes(g)) || arr.some((f) => f.isKids && f.chain === "cinemacity" && /g\s*kids/i.test(f.title));
    films.push({
      id,
      title,
      originalTitle: pick("originalTitle"),
      year: pick("year"),
      runtime: pick("runtime"),
      genres,
      genreKeys,
      ageRating: pick("ageRating"),
      synopsis: pick("synopsis"),
      posterUrl: pick("posterUrl"),
      trailerUrl: pick("trailerUrl"),
      director: pick("director"),
      cast: pick("cast"),
      language: pick("language"),
      isKids,
      isIsraeli,
      isEvent: arr.every((f) => f.isEvent),
      sources: arr.map((f) => ({ chain: f.chain, id: f.sourceId, title: f.title })),
    });
  }
  films.sort((a, b) => a.title.localeCompare(b.title, "he"));

  return { generatedAt: new Date().toISOString(), venues: [...venueMap.values()], films, screenings, sources: reports };
}

/** Display title: strip dubbing / format suffixes but keep the real name. */
function cleanTitle(t: string): string {
  return t
    .replace(/מדובב\s+ל(רוסית|עברית|אנגלית)/g, " ")
    .replace(/\(\s*מדובב(ת)?\s*\)/g, " ")
    .replace(/\s*-\s*מדובב(ת)?\s*$/u, " ")
    .replace(/\s*-\s*אנגלית\s*$/u, " ")
    .replace(/^g\s*kids\s*-\s*/i, "")
    .replace(/^movieretro-?\s*/i, "")
    .replace(/\s*-\s*infinity vision\s*$/i, "")
    .replace(/[Ѐ-ӿ][Ѐ-ӿ\s:!?,.\-–—'"«»]*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, "")
    .trim();
}
