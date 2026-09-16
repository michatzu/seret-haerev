/** Unify films across chains and assemble the snapshot. */
import type { AdapterResult, Chain, Film, RawFilm, Screening, Snapshot, SourceReport, Venue } from "@/lib/types";
import { normalizeTitle, shortHash } from "@/lib/text";
import { canonicalGenres, genreLabel } from "@/lib/genres";

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
    // group on the cleaned title, or a cinematheque's "– דיבוב עברי (שלישי זהב)" makes a new film
    let t = cleanTitle(f.title);
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
/**
 * One edit apart, counting a swap of two adjacent letters as a single edit. Hebrew titles are
 * transliterated by ear, so the same film arrives as both "\u05d4\u05d9\u05de\u05dc\u05d0\u05d9\u05d4" and "\u05d4\u05d9\u05de\u05d0\u05dc\u05d9\u05d4".
 */
function lev1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length === b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) { i += 2; j += 2; continue; } // transposition
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
    const title = (cleanTitles[0] || cleanTitle(arr[0].title) || arr[0].title).replace(/\s+/g, " ").trim();
    const rawGenres = [...new Set(arr.flatMap((f) => f.genres ?? []))];
    const dubbedShare = (dubbedHeCount.get(id) ?? 0) / (totalCount.get(id) ?? 1);
    const isIsraeli = arr.some((f) => f.isIsraeli) || (pick("language") === "he" && dubbedShare < 0.5);
    const genreKeys = canonicalGenres(rawGenres, isIsraeli);
    const genres = genreKeys.filter((k) => k !== "israeli").map(genreLabel);
    // Anything whose title says it is dubbed belongs with the dubbed films, however it is worded.
    const dubbedLabel = arr.some((f) => /מדובב|מדובבת|דיבוב/.test(f.title));
    // Animation is not the same thing as a children's film: Toy Story and Coyote vs. Acme play to
    // adults in the original too, and burying them under "לילדים ומדובבים" hides them from the
    // people looking for them. What actually marks a screening as being for young children is that
    // it is dubbed into Hebrew, so that is the test; a film that only ever plays dubbed goes there
    // whatever its genre, and one that also plays with subtitles stays in the main list.
    // The group is for films you can only see dubbed. An animation that also plays with subtitles
    // has an adult audience too, and burying Toy Story or Coyote vs. Acme there hides it from the
    // people looking for it; its dubbed times still carry a "מדובב" tag in the main list.
    const onlyDubbed = dubbedShare >= 0.999;
    const isKids =
      onlyDubbed ||
      /מדובב|מדובבת/.test(title) ||
      (dubbedLabel && arr.length === 1) ||
      arr.some((f) => f.isKids && f.chain === "cinemacity" && /g\s*kids/i.test(f.title) && dubbedShare > 0.9);
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
      posterUrls: [...new Set(arr.map((f) => f.posterUrl).filter((u): u is string => !!u))],
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
    .replace(/\s*\(\s*שלישי\s+זהב\s*\)\s*/gu, " ")            // a subscription label, not part of the name
    .replace(/\s*\(\s*ללא\s+תשלום\s+למנויים\s*\)\s*/gu, " ")
    .replace(/\s*[-–—]\s*דיבוב\s+עברית?\s*$/u, " ")
    .replace(/\s*[-–—]\s*(סינמטק|מועדון)\s+ילדים\s*$/u, " ")
    .replace(/\s*[-–—]\s*אנגלית\s*$/u, " ")
    .replace(/^g\s*kids\s*-\s*/i, "")
    .replace(/^movieretro-?\s*/i, "")
    .replace(/\s*-\s*infinity vision\s*$/i, "")
    .replace(/[Ѐ-ӿ][Ѐ-ӿ\s:!?,.\-–—'"«»]*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, "")
    .trim();
}

/**
 * Second merge pass, once TMDB has spoken. Chains spell the same film differently enough that the
 * title-based grouping keeps them apart ("קיוטי נגד אקמי" vs "לוני טונס מציגים: קיוטי נגד אקמי –
 * דיבוב עברי"), which shows the film five times in the list. Films that matched the same TMDB
 * entry are the same film, so they collapse into one and their screenings follow.
 */
export function mergeByTmdbId(snapshot: Snapshot): number {
  const groups = new Map<number, Film[]>();
  for (const f of snapshot.films) {
    if (!f.tmdbId) continue;
    const g = groups.get(f.tmdbId);
    if (g) g.push(f);
    else groups.set(f.tmdbId, [f]);
  }

  const remap = new Map<string, string>();
  const dropped = new Set<string>();
  let merged = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // the cleanest title wins: fewest words, then shortest
    const keep = [...group].sort((a, b) => a.title.split(/\s+/).length - b.title.split(/\s+/).length || a.title.length - b.title.length)[0];
    for (const f of group) {
      if (f === keep) continue;
      remap.set(f.id, keep.id);
      dropped.add(f.id);
      merged++;
      keep.sources = [...keep.sources, ...f.sources];
      keep.posterUrls = [...new Set([...(keep.posterUrls ?? []), ...(f.posterUrls ?? []), f.posterUrl].filter((u): u is string => !!u))];
      keep.posterUrl ??= f.posterUrl;
      keep.synopsis ??= f.synopsis;
      keep.runtime ??= f.runtime;
      keep.director ??= f.director;
      keep.trailerUrl ??= f.trailerUrl;
      keep.ageRating ??= f.ageRating;
      if (!keep.cast?.length && f.cast?.length) keep.cast = f.cast;
      if (!keep.genreKeys.length && f.genreKeys.length) { keep.genreKeys = f.genreKeys; keep.genres = f.genres; }
      keep.isKids ||= f.isKids;
      keep.isIsraeli ||= f.isIsraeli;
      keep.isEvent &&= f.isEvent;
    }
  }
  if (!merged) return 0;
  for (const s of snapshot.screenings) {
    const to = remap.get(s.filmId);
    if (to) s.filmId = to;
  }
  snapshot.films = snapshot.films.filter((f) => !dropped.has(f.id));
  return merged;
}

/** Ratings from this many people mean an audience wider than the nursery. */
const WIDE_AUDIENCE_VOTES = 50_000;

/**
 * Who a film is for, settled after the enrichment has landed.
 *
 * What marks a film as one for young children is that you can only see it dubbed: a child who
 * cannot read subtitles yet has no other way in. Screenings nobody tagged say nothing either way,
 * so the test weighs dubbed showings against subtitled ones rather than against the whole
 * schedule — five untagged times out of a hundred used to be enough to keep a film out of the
 * group, which is how "דג ושמו באסה" and "טד החוקר" ended up in the main list.
 *
 * The exception is the animation the whole world watches: Toy Story and Coyote vs. Acme play to
 * grown-ups too, and burying them here hides them from the people looking for them.
 *
 * Being Israeli is settled here for the same reason: for most of the catalogue only TMDB knows
 * what language a film was made in, and it says so long after the grouping has run.
 */
export function classifyAudience(snapshot: Snapshot): void {
  const total = new Map<string, number>(), dubbedHe = new Map<string, number>(), subbed = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const s of snapshot.screenings) {
    bump(total, s.filmId);
    if (s.dubbedLang === "he") bump(dubbedHe, s.filmId);
    if (s.attrs.includes("subbed")) bump(subbed, s.filmId);
  }

  for (const film of snapshot.films) {
    const he = dubbedHe.get(film.id) ?? 0, sub = subbed.get(film.id) ?? 0;
    const dubbedShare = he / (total.get(film.id) || 1);

    // A film made in Hebrew is an Israeli film — unless the Hebrew is the dubbing.
    if (film.country === "ישראל" || (film.language === "he" && dubbedShare < 0.5)) film.isIsraeli = true;
    if (film.isIsraeli && !film.genreKeys.includes("israeli")) film.genreKeys = canonicalGenres(film.genres, true);

    // A subtitled showing is the way in for anyone who can already read, so it is what keeps a
    // film out of the group. Where nothing is tagged either way, the cinemas' own wording answers.
    const tagged = he + sub;
    const dubbedOnly = tagged > 0 ? sub / tagged < 0.05 : film.sources.every((s) => /מדובב|מדובבת|דיבוב/.test(s.title));
    // A name that says "מדובב" is the listing's own word for itself, and outranks all of it.
    film.isKids = /מדובב|מדובבת/.test(film.title) || (dubbedOnly && (film.imdbVotes ?? 0) < WIDE_AUDIENCE_VOTES);
  }
}
