/**
 * Optional enrichment from TMDB (posters, Hebrew synopsis, country, year, credits, trailer)
 * and OMDb (IMDb rating). Skipped when the API keys are missing. Results are cached on disk.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Film } from "@/lib/types";
import { getJson, pool } from "./http";
import { loadImdbRatings } from "./imdb";
import { canonicalGenres, genreLabel } from "@/lib/genres";

const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const CACHE_FILE = path.join(process.cwd(), "data", "enrich-cache.json");

interface CacheEntry { v?: number; at: string; tmdbId?: number | null; data?: Enrichment; imdbRating?: number | null; imdbVotes?: number; imdbAt?: string }
/**
 * Bumped whenever the rules below change what counts as a match. The cache outlives a deploy — it
 * is restored from the data branch on every run — so without this a fixed rule would keep handing
 * back the answer it was written to correct.
 */
const MATCH_VERSION = 5;
type Cache = Record<string, CacheEntry>;

export interface Enrichment {
  tmdbId: number;
  imdbId?: string;
  originalTitle?: string;
  year?: number;
  country?: string;
  runtime?: number;
  genres?: string[];
  synopsis?: string;
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  director?: string;
  cast?: string[];
  /** alternate spellings of the names above, for search only */
  searchNames?: string[];
  language?: string;
  popularity?: number;
}

const COUNTRY_HE: Record<string, string> = {
  US: "ארה״ב", GB: "בריטניה", FR: "צרפת", DE: "גרמניה", IT: "איטליה", ES: "ספרד", IL: "ישראל", JP: "יפן", KR: "קוריאה",
  CA: "קנדה", AU: "אוסטרליה", SE: "שוודיה", DK: "דנמרק", NO: "נורווגיה", FI: "פינלנד", NL: "הולנד", BE: "בלגיה", IE: "אירלנד",
  NZ: "ניו זילנד", IN: "הודו", CN: "סין", HK: "הונג קונג", TW: "טייוואן", AR: "ארגנטינה", BR: "ברזיל", MX: "מקסיקו", CL: "צ׳ילה",
  PL: "פולין", RU: "רוסיה", TR: "טורקיה", AT: "אוסטריה", CH: "שווייץ", CZ: "צ׳כיה", HU: "הונגריה", GR: "יוון", PT: "פורטוגל",
  UA: "אוקראינה", IR: "איראן", RO: "רומניה", IS: "איסלנד", ZA: "דרום אפריקה", TH: "תאילנד", ID: "אינדונזיה", PS: "פלסטין", EG: "מצרים", MA: "מרוקו", LB: "לבנון",
  PH: "הפיליפינים", CY: "קפריסין", BG: "בולגריה", RS: "סרביה", HR: "קרואטיה", SK: "סלובקיה", SI: "סלובניה", EE: "אסטוניה", LV: "לטביה", LT: "ליטא",
  GE: "גאורגיה", AM: "ארמניה", AZ: "אזרבייג׳ן", KZ: "קזחסטן", LU: "לוקסמבורג", MT: "מלטה", AL: "אלבניה", MK: "מקדוניה", BA: "בוסניה", ET: "אתיופיה",
  NG: "ניגריה", KE: "קניה", SN: "סנגל", TN: "תוניסיה", DZ: "אלג׳יריה", JO: "ירדן", IQ: "עיראק", SY: "סוריה", SA: "סעודיה", AE: "איחוד האמירויות", QA: "קטאר",
  VN: "וייטנאם", SG: "סינגפור", MY: "מלזיה", PK: "פקיסטן", BD: "בנגלדש", NP: "נפאל", LK: "סרי לנקה", CO: "קולומביה", PE: "פרו", UY: "אורוגוואי",
  VE: "ונצואלה", CU: "קובה", CR: "קוסטה ריקה", BO: "בוליביה", PY: "פרגוואי", EC: "אקוודור", GT: "גואטמלה", PA: "פנמה", DO: "הרפובליקה הדומיניקנית",
};

async function loadCache(): Promise<Cache> {
  try { return JSON.parse(await readFile(CACHE_FILE, "utf8")); } catch { return {}; }
}
async function saveCache(c: Cache) {
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(c));
}

const DAY = 86_400_000;
const fresh = (iso: string | undefined, days: number) => !!iso && Date.now() - new Date(iso).getTime() < days * DAY;

/** Enrich films in place. Safe no-op without TMDB_API_KEY. */
export async function enrichFilms(films: Film[]): Promise<{ matched: number; rated: number; skipped: boolean }> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return { matched: 0, rated: 0, skipped: true };
  const cache = await loadCache();
  let matched = 0, rated = 0;

  await pool(films, 4, async (film) => {
    if (film.isEvent) return;
    const ck = film.id;
    let entry = cache[ck];
    if (!entry || entry.v !== MATCH_VERSION || !fresh(entry.at, 14) || (entry.tmdbId === null && !fresh(entry.at, 2))) {
      // Read each candidate's details before accepting it, and never twice for the same film.
      const seen = new Map<number, Enrichment | undefined>();
      const detailsOf = async (id: number) => {
        if (!seen.has(id)) seen.set(id, await fetchDetails(key, id).catch(() => undefined));
        return seen.get(id);
      };
      const tmdbId = await findTmdbId(key, film, async (id) => runtimeAgrees(film.runtime, (await detailsOf(id))?.runtime));
      entry = { v: MATCH_VERSION, at: new Date().toISOString(), tmdbId: tmdbId ?? null, imdbRating: entry?.imdbRating, imdbVotes: entry?.imdbVotes, imdbAt: entry?.imdbAt };
      if (tmdbId) entry.data = await detailsOf(tmdbId);
      cache[ck] = entry;
    }
    const d = entry.data;
    if (!d) return;
    matched++;
    film.originalTitle ??= d.originalTitle;
    film.year ??= d.year;
    film.country ??= d.country;
    film.runtime ??= d.runtime;
    // TMDB's Hebrew is its own ("מותחן", "משפחה"), and a genre that never becomes a key is a
    // genre the filter cannot see: a quarter of the catalogue was showing a word on the card that
    // matched nothing in the menu above it.
    if (!film.genreKeys.length && d.genres?.length) {
      const keys = canonicalGenres(d.genres, film.isIsraeli);
      if (keys.length) {
        film.genreKeys = keys;
        film.genres = keys.filter((k) => k !== "israeli").map(genreLabel);
      }
    }
    film.synopsis = d.synopsis || film.synopsis;
    film.posterUrl ??= d.posterUrl;
    film.backdropUrl ??= d.backdropUrl;
    film.trailerUrl ??= d.trailerUrl;
    film.director ??= d.director;
    if (!film.cast?.length && d.cast?.length) film.cast = d.cast;
    if (d.searchNames?.length) film.searchNames = d.searchNames;
    film.language ??= d.language;
    film.tmdbId = d.tmdbId;
    film.imdbId = d.imdbId;
    film.tmdbPopularity = d.popularity;
  });

  // IMDb ratings from IMDb's own daily dataset, refreshed once a day per film
  const need = new Set<string>();
  for (const film of films) {
    const e = cache[film.id];
    if (film.imdbId && (!e?.imdbAt || !fresh(e.imdbAt, 1))) need.add(film.imdbId);
  }
  if (need.size) {
    try {
      const ratings = await loadImdbRatings(need);
      for (const film of films) {
        const e = cache[film.id];
        if (!film.imdbId || !e || !need.has(film.imdbId)) continue;
        const r = ratings.get(film.imdbId);
        e.imdbRating = r?.rating ?? null;
        e.imdbVotes = r?.votes;
        e.imdbAt = new Date().toISOString();
      }
    } catch (err) {
      console.warn("imdb ratings:", err instanceof Error ? err.message : err);
    }
  }
  // An average over a handful of votes is noise, not a rating: an 8-vote 9.4 would outrank
  // The Lord of the Rings both on the card and in the IMDb sort.
  const MIN_VOTES = 50;
  for (const film of films) {
    const e = cache[film.id];
    if (e?.imdbRating && (e.imdbVotes ?? 0) >= MIN_VOTES) {
      film.imdbRating = e.imdbRating;
      film.imdbVotes = e.imdbVotes;
      rated++;
    }
  }

  await saveCache(cache);
  return { matched, rated, skipped: false };
}

interface SearchHit { id: number; title: string; original_title: string; release_date?: string; popularity: number; vote_count: number; genre_ids?: number[] }

async function findTmdbId(key: string, film: Film, accept: (id: number) => Promise<boolean>): Promise<number | undefined> {
  const queries: { q: string; lang: string }[] = [];
  if (film.originalTitle) queries.push({ q: film.originalTitle, lang: "en-US" });
  queries.push({ q: film.title, lang: "he-IL" });
  // One cinema's "\u05e4\u05d5\u05dc\u05d7\u05df" is another's "\u05e4\u05d5\u05dc\u05d7\u05df \u05d4\u05d3\u05de\u05d9\u05dd". The longer name is the one TMDB knows, and
  // a title we only hold in its short form is exactly the one that matches the wrong film.
  for (const s of film.sources) {
    const t = s.title.replace(/\s+/g, " ").trim();
    if (t && !queries.some((q) => q.q === t)) queries.push({ q: t, lang: "he-IL" });
  }
  // A title stripped of its subtitle is the weakest thing we ask with, so it has to keep at least
  // two words: Fassbinder's "\u05e2\u05dc\u05d9: \u05e4\u05d7\u05d3 \u05d0\u05d5\u05db\u05dc \u05d0\u05ea \u05d4\u05e0\u05e9\u05de\u05d4" cut down to "\u05e2\u05dc\u05d9" is the exact Hebrew name of Michael Mann's Ali.
  const stem = film.title.split(":")[0].trim();
  if (film.title.includes(":") && stem.split(/\s+/).length >= 2) queries.push({ q: stem, lang: "he-IL" });
  for (const { q, lang } of queries) {
    const url = `${TMDB}/search/movie?api_key=${key}&language=${lang}&region=IL&include_adult=false&query=${encodeURIComponent(q)}${film.year ? `&primary_release_year=${film.year}` : ""}`;
    let res = await getJson<{ results: SearchHit[] }>(url);
    if (!res.results.length && film.year) res = await getJson<{ results: SearchHit[] }>(url.replace(/&primary_release_year=\d+/, ""));
    const hits = res.results.filter((h) => h.vote_count > 0 || h.popularity > 1);
    if (!hits.length) continue;
    // prefer recent releases (we list current screenings) and the closest year
    const now = new Date().getFullYear();
    hits.sort((a, b) => score(b, film.year, now) - score(a, film.year, now));
    // TMDB matches loosely on alternative titles, which once turned "\u05d4\u05de\u05e9\u05d7\u05e7" into Avengers:
    // Endgame ("\u05e1\u05d5\u05e3 \u05d4\u05de\u05e9\u05d7\u05e7"). Require the winner to actually resemble what we asked for.
    const agrees = hits.find((h) => titlesAgree(q, h.title) || titlesAgree(q, h.original_title));
    if (agrees && await accept(agrees.id)) return agrees.id;
    // A hit that shares a word with the query without agreeing is the dangerous kind: a different
    // film whose name begins the same way. No shared word at all means TMDB answered through an
    // alternative title it holds on record, which is worth trusting.
    if (hits.length === 1 && sharesAWord(q, hits[0])) continue;
    // TMDB also matches alternative titles, which is how "\u05e1\u05e7\u05d5\u05d8 \u05e4\u05d9\u05dc\u05d2\u05e8\u05d9\u05dd \u05e0\u05d2\u05d3 \u05d4\u05e2\u05d5\u05dc\u05dd" finds a film
    // released here as "\u05d4\u05d0\u05e7\u05e1\u05d9\u05dd \u05e9\u05dc \u05d4\u05d7\u05d1\u05e8\u05d4 \u05e9\u05dc\u05d9". One hit for a title of several words is that, not a coincidence.
    if (hits.length === 1 && q.trim().split(/\s+/).length >= 2 && await knownAs(key, hits[0].id, q) && await accept(hits[0].id)) return hits[0].id;
  }
  return undefined;
}

/** Whether TMDB itself files this film under something like the name we asked for. */
async function knownAs(key: string, id: number, q: string): Promise<boolean> {
  const res = await getJson<{ titles?: { title: string }[] }>(`${TMDB}/movie/${id}/alternative_titles?api_key=${key}`).catch(() => undefined);
  return !!res?.titles?.some((t) => titlesAgree(q, t.title));
}

/**
 * The cinema publishes a running time; TMDB publishes its own. Rounding, credits and a regional
 * cut explain a few minutes between them — half of the catalogue agrees to the minute — but a
 * film a good half-hour apart is a different film, however close the name. This is what separates
 * the Argentine "\u05d4\u05de\u05e9\u05d7\u05e7" from Fincher's, and Kenji Tanigaki's "\u05d4\u05d6\u05e2\u05dd" from a horror film of 2019.
 */
const RUNTIME_SLACK_MIN = 25;
function runtimeAgrees(cinema: number | undefined, tmdb: number | undefined): boolean {
  if (!cinema || !tmdb) return true; // no claim to contradict
  return Math.abs(cinema - tmdb) <= RUNTIME_SLACK_MIN;
}
/** Loose title comparison: same words, ignoring order, punctuation and a leading Hebrew "\u05d4". */
function titleTokens(t: string): Set<string> {
  return new Set(
    t.toLowerCase()
      .replace(/[\u0591-\u05c7]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(" ")
      .filter((w) => w.length > 1)
      .map((w) => w.replace(/^\u05d4(?=.{2})/, "")),
  );
}
/** True when one title's words are largely contained in the other's. */
function titlesAgree(a: string, b: string): boolean {
  const A = titleTokens(a), B = titleTokens(b);
  if (!A.size || !B.size) return false;
  const [small, big] = A.size <= B.size ? [A, B] : [B, A];
  let shared = 0;
  for (const w of small) if (big.has(w)) shared++;
  if (shared / small.size < 0.7) return false;
  // A one-word title has to meet a one-word title. Let it match a longer name on that single word
  // and "\u05d3\u05e8\u05d9\u05d9\u05d1" becomes Mulholland Drive, "\u05e4\u05ea\u05d0\u05d5\u05dd" becomes \u05e4\u05ea\u05d0\u05d5\u05dd 30 and "\u05d4\u05d7\u05ea\u05d5\u05e0\u05d4" becomes
  // \u05d4\u05d7\u05ea\u05d5\u05e0\u05d4 \u05d4\u05d2\u05d3\u05d5\u05dc\u05d4 \u2014 each of them a real, different film now playing somewhere else.
  return small.size >= 2 || big.size === 1;
}

/** Whether a hit answers the query with one of its own words, rather than through another title. */
function sharesAWord(q: string, h: SearchHit): boolean {
  const Q = titleTokens(q);
  for (const t of [h.title, h.original_title]) {
    for (const w of titleTokens(t)) if (Q.has(w)) return true;
  }
  return false;
}

function score(h: SearchHit, year: number | undefined, now: number): number {
  const y = h.release_date ? Number(h.release_date.slice(0, 4)) : undefined;
  let s = Math.log10(1 + h.popularity) * 2;
  if (year && y) s += y === year ? 6 : Math.abs(y - year) === 1 ? 3 : -2;
  else if (y) s += y >= now - 1 ? 3 : y >= now - 3 ? 1 : -1;
  return s;
}

interface Details {
  id: number; title: string; original_title: string; original_language: string; overview: string; release_date?: string; runtime?: number;
  popularity: number; poster_path?: string | null; backdrop_path?: string | null;
  genres?: { name: string }[]; production_countries?: { iso_3166_1: string }[]; origin_country?: string[];
  spoken_languages?: { iso_639_1: string; english_name?: string }[];
  external_ids?: { imdb_id?: string | null };
  credits?: { cast?: { name: string; order: number }[]; crew?: { job: string; name: string }[] };
  videos?: { results?: { site: string; type: string; key: string; iso_639_1: string; official?: boolean }[] };
}

async function fetchDetails(key: string, id: number): Promise<Enrichment> {
  const he = await getJson<Details>(`${TMDB}/movie/${id}?api_key=${key}&language=he-IL&append_to_response=credits,videos,external_ids`);
  // The English credits are always fetched: TMDB translates some names and not others, so a viewer
  // typing "נולאן" and a viewer typing "Nolan" are both looking for the same film. The Latin
  // spellings are kept for search only; the page shows the Hebrew ones.
  const en = await getJson<Details>(`${TMDB}/movie/${id}?api_key=${key}&language=en-US&append_to_response=videos,credits`).catch(() => undefined);
  const video = [...(he.videos?.results ?? []), ...(en?.videos?.results ?? [])].filter((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
  video.sort((a, b) => Number(b.type === "Trailer") - Number(a.type === "Trailer") || Number(b.official ?? false) - Number(a.official ?? false));
  // origin_country is where the film is from; production_countries lists every co-producer, and its
  // first entry is arbitrary (Sentimental Value, a Norwegian film, starts with Turkey there)
  const country = he.origin_country?.[0] ?? he.production_countries?.[0]?.iso_3166_1;
  const director = he.credits?.crew?.filter((c) => c.job === "Director").map((c) => c.name).join(", ") || undefined;
  return {
    tmdbId: he.id,
    imdbId: he.external_ids?.imdb_id ?? undefined,
    originalTitle: he.original_title,
    year: he.release_date ? Number(he.release_date.slice(0, 4)) : undefined,
    country: country ? COUNTRY_HE[country] ?? country : undefined,
    runtime: he.runtime || undefined,
    genres: he.genres?.map((g) => g.name),
    synopsis: he.overview || undefined,
    posterUrl: he.poster_path ? `${IMG}/w342${he.poster_path}` : undefined,
    backdropUrl: he.backdrop_path ? `${IMG}/w780${he.backdrop_path}` : undefined,
    trailerUrl: video[0] ? `https://www.youtube.com/watch?v=${video[0].key}` : undefined,
    director,
    cast: he.credits?.cast?.slice(0, 6).map((c) => c.name),
    searchNames: [
      ...(en?.credits?.crew?.filter((c) => c.job === "Director").map((c) => c.name) ?? []),
      ...(en?.credits?.cast?.slice(0, 6).map((c) => c.name) ?? []),
      en?.title ?? "",
    ].filter((n, i, all) => n && all.indexOf(n) === i),
    // spoken_languages lists every tongue heard anywhere in the film, in no particular order: it
    // opens with Danish for a French film about a Danish architect, and with Russian for The
    // Brutalist. original_language is the one the film was made in, which is the one to name.
    language: he.original_language || he.spoken_languages?.[0]?.iso_639_1,
    popularity: he.popularity,
  };
}
