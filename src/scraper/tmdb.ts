/**
 * Optional enrichment from TMDB (posters, Hebrew synopsis, country, year, credits, trailer)
 * and OMDb (IMDb rating). Skipped when the API keys are missing. Results are cached on disk.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Film } from "@/lib/types";
import { getJson, pool } from "./http";
import { loadImdbRatings } from "./imdb";

const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const CACHE_FILE = path.join(process.cwd(), "data", "enrich-cache.json");

interface CacheEntry { at: string; tmdbId?: number | null; data?: Enrichment; imdbRating?: number | null; imdbVotes?: number; imdbAt?: string }
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
  language?: string;
  popularity?: number;
}

const COUNTRY_HE: Record<string, string> = {
  US: "ארה״ב", GB: "בריטניה", FR: "צרפת", DE: "גרמניה", IT: "איטליה", ES: "ספרד", IL: "ישראל", JP: "יפן", KR: "קוריאה",
  CA: "קנדה", AU: "אוסטרליה", SE: "שוודיה", DK: "דנמרק", NO: "נורווגיה", FI: "פינלנד", NL: "הולנד", BE: "בלגיה", IE: "אירלנד",
  NZ: "ניו זילנד", IN: "הודו", CN: "סין", HK: "הונג קונג", TW: "טייוואן", AR: "ארגנטינה", BR: "ברזיל", MX: "מקסיקו", CL: "צ׳ילה",
  PL: "פולין", RU: "רוסיה", TR: "טורקיה", AT: "אוסטריה", CH: "שווייץ", CZ: "צ׳כיה", HU: "הונגריה", GR: "יוון", PT: "פורטוגל",
  UA: "אוקראינה", IR: "איראן", RO: "רומניה", IS: "איסלנד", ZA: "דרום אפריקה", TH: "תאילנד", ID: "אינדונזיה", PS: "פלסטין", EG: "מצרים", MA: "מרוקו", LB: "לבנון",
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
    if (!entry || !fresh(entry.at, 14) || (entry.tmdbId === null && !fresh(entry.at, 2))) {
      const tmdbId = await findTmdbId(key, film);
      entry = { at: new Date().toISOString(), tmdbId: tmdbId ?? null };
      if (tmdbId) entry.data = await fetchDetails(key, tmdbId).catch(() => undefined);
      cache[ck] = entry;
    }
    const d = entry.data;
    if (!d) return;
    matched++;
    film.originalTitle ??= d.originalTitle;
    film.year ??= d.year;
    film.country ??= d.country;
    film.runtime ??= d.runtime;
    if (!film.genres.length && d.genres?.length) film.genres = d.genres;
    film.synopsis = d.synopsis || film.synopsis;
    film.posterUrl ??= d.posterUrl;
    film.backdropUrl ??= d.backdropUrl;
    film.trailerUrl ??= d.trailerUrl;
    film.director ??= d.director;
    if (!film.cast?.length && d.cast?.length) film.cast = d.cast;
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

async function findTmdbId(key: string, film: Film): Promise<number | undefined> {
  const queries: { q: string; lang: string }[] = [];
  if (film.originalTitle) queries.push({ q: film.originalTitle, lang: "en-US" });
  queries.push({ q: film.title, lang: "he-IL" });
  // also try the title without a subtitle after ":"
  if (film.title.includes(":")) queries.push({ q: film.title.split(":")[0], lang: "he-IL" });
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
    const best = hits.find((h) => titlesAgree(q, h.title) || titlesAgree(q, h.original_title));
    if (best) return best.id;
  }
  return undefined;
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
  // a single common word inside a much longer title is a coincidence, not a match:
  // "\u05d4\u05de\u05e9\u05d7\u05e7" is not "\u05d4\u05e0\u05d5\u05e7\u05de\u05d9\u05dd: \u05e1\u05d5\u05e3 \u05d4\u05de\u05e9\u05d7\u05e7"
  return small.size >= 2 || big.size <= 2;
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
  external_ids?: { imdb_id?: string | null };
  credits?: { cast?: { name: string; order: number }[]; crew?: { job: string; name: string }[] };
  videos?: { results?: { site: string; type: string; key: string; iso_639_1: string; official?: boolean }[] };
}

async function fetchDetails(key: string, id: number): Promise<Enrichment> {
  const he = await getJson<Details>(`${TMDB}/movie/${id}?api_key=${key}&language=he-IL&append_to_response=credits,videos,external_ids`);
  const needEn = !he.overview || !(he.videos?.results?.length);
  const en = needEn ? await getJson<Details>(`${TMDB}/movie/${id}?api_key=${key}&language=en-US&append_to_response=videos`).catch(() => undefined) : undefined;
  const video = [...(he.videos?.results ?? []), ...(en?.videos?.results ?? [])].filter((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
  video.sort((a, b) => Number(b.type === "Trailer") - Number(a.type === "Trailer") || Number(b.official ?? false) - Number(a.official ?? false));
  const country = he.production_countries?.[0]?.iso_3166_1 ?? he.origin_country?.[0];
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
    language: he.original_language,
    popularity: he.popularity,
  };
}
