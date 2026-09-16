/** Filter / sort model shared by the list and the film page. Everything lives in the URL. */
import type { Film, Screening, Venue } from "./types";
import { distanceKm, type LatLng } from "./geo";
import { TZ, ymdInIsrael, ymdPlusDays } from "./tz";
import { genreLabel } from "./genres";

export type DayKey = "today" | "tomorrow" | "d2" | "d3" | "week" | "month";
export type FromKey = "now" | "noon" | "evening" | "night" | "all";
export type RadiusKey = "5" | "15" | "30" | "all";
export type HallKey = "imax" | "vip" | "4dx" | "screenx" | "3d" | "cinematheque" | "outdoor";
export type SortKey = "dist" | "time" | "imdb";

export interface Query {
  day: DayKey;
  /** "now" is only meaningful today; "all" = the whole day */
  from: FromKey;
  radius: RadiusKey;
  /** [] = all halls */
  halls: HallKey[];
  /** venue ids, [] = all */
  venues: string[];
  /** canonical genre keys, [] = all */
  genres: string[];
  /** free text over titles, directors and cast */
  q: string;
  sort: SortKey;
  kids: boolean; // kids group expanded
  small: boolean; // films with no artwork, grouped so they do not pock the list
  far: boolean; // "farther" group expanded
}

/** More than one day: the list groups by day and cannot sort by clock time. */
export function isMultiDay(d: DayKey): boolean {
  return d === "week" || d === "month";
}

const DAYS: DayKey[] = ["today", "tomorrow", "d2", "d3", "week", "month"];
const FROMS: FromKey[] = ["now", "noon", "evening", "night", "all"];
const RADII: RadiusKey[] = ["5", "15", "30", "all"];
export const HALLS: HallKey[] = ["imax", "vip", "4dx", "screenx", "3d", "cinematheque", "outdoor"];
const SORTS: SortKey[] = ["dist", "time", "imdb"];

export const DEFAULT_RADIUS: RadiusKey = "15";
/**
 * Today the useful default is "from now", because anything earlier has already started. On any
 * other day there is no "now" to start from, and narrowing to the evening hides matinees the
 * viewer never asked to hide, so the whole day is shown.
 */
export const defaultFrom = (day: DayKey): FromKey => (day === "today" ? "now" : "all");

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const list = (v: string | string[] | undefined) => (one(v) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const pick = <T extends string>(v: string | undefined, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

export function parseQuery(sp: SP): Query {
  const day = pick(one(sp.day), DAYS, "today");
  let from = pick(one(sp.from), FROMS, defaultFrom(day));
  if (from === "now" && day !== "today") from = "evening";
  const radius = pick(one(sp.r), RADII, DEFAULT_RADIUS);
  const halls = [...new Set(list(sp.hall).filter((h): h is HallKey => HALLS.includes(h as HallKey)))];
  const venues = [...new Set(list(sp.v))];
  const genres = [...new Set(list(sp.g))];
  const q = (one(sp.q) ?? "").trim().slice(0, 60);
  let sort = pick(one(sp.sort), SORTS, "dist");
  if (isMultiDay(day) && sort === "time") sort = "dist";
  return { day, from, radius, halls, venues, genres, q, sort, kids: one(sp.kids) === "1", small: one(sp.small) === "1", far: one(sp.far) === "1" };
}

/** Serialise a query back to search params, omitting defaults. */
export function queryToSearch(q: Query): string {
  const p = new URLSearchParams();
  if (q.day !== "today") p.set("day", q.day);
  if (q.from !== defaultFrom(q.day)) p.set("from", q.from);
  if (q.radius !== DEFAULT_RADIUS) p.set("r", q.radius);
  if (q.halls.length) p.set("hall", q.halls.join(","));
  if (q.venues.length) p.set("v", q.venues.join(","));
  if (q.genres.length) p.set("g", q.genres.join(","));
  if (q.q) p.set("q", q.q);
  if (q.sort !== "dist") p.set("sort", q.sort);
  if (q.kids) p.set("kids", "1");
  if (q.small) p.set("small", "1");
  if (q.far) p.set("far", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}

/* ---- labels (Hebrew) ---- */
const wdFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long" });
export function dayLabel(day: DayKey, now = new Date()): string {
  switch (day) {
    case "today": return "היום";
    case "tomorrow": return "מחר";
    case "week": return "השבוע";
    case "month": return "החודש";
    case "d2": return wdFmt.format(new Date(now.getTime() + 2 * 864e5));
    case "d3": return wdFmt.format(new Date(now.getTime() + 3 * 864e5));
  }
}
export const FROM_LABELS: Record<FromKey, string> = { now: "מעכשיו", noon: "בצהריים", evening: "בערב", night: "בלילה", all: "בכל שעה" };
export const RADIUS_LABELS: Record<RadiusKey, string> = { "5": "עד 5 ק״מ", "15": "עד 15 ק״מ", "30": "עד 30 ק״מ", all: "בכל הארץ" };
export const HALL_LABELS: Record<HallKey, string> = { imax: "IMAX", vip: "VIP", "4dx": "4DX", screenx: "ScreenX", "3d": "3D", cinematheque: "סינמטק", outdoor: "חוץ" };
export function hallsLabel(halls: HallKey[]): string {
  if (!halls.length) return "כל האולמות";
  return HALLS.filter((h) => halls.includes(h)).map((h) => HALL_LABELS[h]).join(", ");
}
export function venuesLabel(ids: string[], names: Map<string, string>): string {
  if (!ids.length) return "כל בתי הקולנוע";
  if (ids.length === 1) return names.get(ids[0]) ?? "בית קולנוע אחד";
  return `${ids.length} בתי קולנוע`;
}
export function genresLabel(keys: string[]): string {
  if (!keys.length) return "כל הז׳אנרים";
  if (keys.length === 1) return genreLabel(keys[0]);
  return `${keys.length} ז׳אנרים`;
}
export const SORT_LABELS: Record<SortKey, string> = { dist: "לפי קרבה", time: "לפי שעה", imdb: "לפי IMDb" };


/* ---- free-text search ---- */

/** Hebrew is typed with and without the geresh, and cast names arrive in both scripts. */
function foldText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/["'\u05f3\u05f4\u2018\u2019\u201c\u201d.,:;!?()\[\]{}\-\u2013\u2014_/\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SearchHit { field: "title" | "director" | "cast"; value: string }

/**
 * Does the film answer to this text, and why? The reason is shown on the card, because a result
 * that matched an actor the viewer typed should say so rather than look like a mistake.
 */
export function searchMatch(film: Film, query: string): SearchHit | null {
  const q = foldText(query);
  if (!q) return null;
  const terms = q.split(" ").filter(Boolean);
  const hits = (value: string | undefined) => {
    if (!value) return false;
    const v = foldText(value);
    return terms.every((t) => v.includes(t));
  };
  if (hits(film.title) || hits(film.originalTitle)) return { field: "title", value: film.title };
  if (hits(film.director)) return { field: "director", value: film.director! };
  const actor = film.cast?.find((c) => hits(c));
  if (actor) return { field: "cast", value: actor };
  // the same people under their other spelling: the card still shows the Hebrew name
  const alt = film.searchNames?.findIndex((n) => hits(n)) ?? -1;
  if (alt >= 0) {
    const isDirector = alt === 0 && !!film.director;
    return { field: isDirector ? "director" : "cast", value: (isDirector ? film.director : film.cast?.[alt - 1]) ?? film.searchNames![alt] };
  }
  return null;
}

/* ---- time windows ---- */
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
function hourOf(iso: string): number {
  const [h, m] = hourFmt.format(new Date(iso)).split(":").map(Number);
  return h + m / 60;
}

export function datesFor(day: DayKey, now = new Date()): string[] {
  switch (day) {
    case "today": return [ymdPlusDays(0, now)];
    case "tomorrow": return [ymdPlusDays(1, now)];
    case "d2": return [ymdPlusDays(2, now)];
    case "d3": return [ymdPlusDays(3, now)];
    case "week": return Array.from({ length: 7 }, (_, i) => ymdPlusDays(i, now));
    case "month": return Array.from({ length: 31 }, (_, i) => ymdPlusDays(i, now));
  }
}

export function inTimeWindow(iso: string, from: FromKey, now: Date): boolean {
  if (from === "all") return true;
  if (from === "now") return new Date(iso).getTime() >= now.getTime() - 15 * 60_000; // started up to 15 minutes ago
  const h = hourOf(iso);
  if (from === "noon") return h >= 12 && h < 17;
  if (from === "evening") return h >= 17 && h < 21;
  return h >= 21 || h < 4;
}

export function matchesHalls(s: Screening, venue: Venue, halls: HallKey[]): boolean {
  if (!halls.length) return true;
  return halls.some((h) => {
    if (h === "cinematheque") return venue.kind === "cinematheque";
    if (h === "outdoor") return s.attrs.includes("outdoor") || venue.kind === "outdoor";
    return s.attrs.includes(h);
  });
}
export function matchesGenres(film: Film, genres: string[]): boolean {
  if (!genres.length) return true;
  return genres.some((g) => (g === "israeli" ? film.isIsraeli : film.genreKeys.includes(g)));
}

export const RADIUS_KM: Record<RadiusKey, number> = { "5": 5, "15": 15, "30": 30, all: Infinity };

/** Hall type of a screening, for grouping on the film page. */
export function hallType(s: Screening, venue?: Venue): string {
  if (s.attrs.includes("imax")) return "IMAX";
  if (s.attrs.includes("4dx")) return "4DX";
  if (s.attrs.includes("screenx")) return "ScreenX";
  if (s.attrs.includes("vip")) return "VIP";
  if (s.attrs.includes("35mm")) return "35 מ״מ";
  if (s.attrs.includes("outdoor") || venue?.kind === "outdoor") return "חוץ";
  if (s.attrs.includes("3d")) return "3D";
  return "רגיל";
}
const HALL_ORDER = ["רגיל", "IMAX", "4DX", "ScreenX", "VIP", "3D", "35 מ״מ", "חוץ"];
export const hallOrder = (a: string, b: string) => HALL_ORDER.indexOf(a) - HALL_ORDER.indexOf(b);

/** Does a screening pass every filter except distance? */
/** Grace for a screening that has just begun: the box office usually still sells for a few minutes. */
export const STARTED_GRACE_MS = 15 * 60_000;

export function passes(s: Screening, film: Film, venue: Venue, q: Query, dates: Set<string>, now: Date): boolean {
  if (!dates.has(ymdInIsrael(new Date(s.startsAt)))) return false;
  // A screening that has already run cannot be booked, and its ticket page is dead. It is worse
  // than useless on the page: it makes every other time on the page look untrustworthy.
  if (new Date(s.startsAt).getTime() < now.getTime() - STARTED_GRACE_MS) return false;
  if (!inTimeWindow(s.startsAt, q.from, now)) return false;
  if (q.venues.length && !q.venues.includes(venue.id)) return false;
  if (!matchesHalls(s, venue, q.halls)) return false;
  if (!matchesGenres(film, q.genres)) return false;
  if (q.q && !searchMatch(film, q.q)) return false;
  return true;
}

/* ---- list assembly ---- */
export interface VenueTimes { venue: Venue; distanceKm: number; screenings: Screening[] }
export interface FilmRow { film: Film; venues: VenueTimes[]; nearestKm: number; nextAt: string; total: number; days: number[] }
export interface ListResult { main: FilmRow[]; kids: FilmRow[]; small: FilmRow[]; farther: FilmRow[]; dates: string[] }

export function buildList(films: Map<string, Film>, venues: Map<string, Venue>, screenings: Screening[], q: Query, here: LatLng, now = new Date()): ListResult {
  const dates = new Set(datesFor(q.day, now));
  const maxKm = RADIUS_KM[q.radius];
  const dist = new Map<string, number>();
  for (const v of venues.values()) dist.set(v.id, distanceKm(here, v));

  type Acc = { film: Film; near: Map<string, Screening[]>; far: Map<string, Screening[]> };
  const acc = new Map<string, Acc>();
  for (const s of screenings) {
    const venue = venues.get(s.venueId);
    const film = films.get(s.filmId);
    if (!venue || !film || film.isEvent) continue;
    if (!passes(s, film, venue, q, dates, now)) continue;
    let a = acc.get(film.id);
    if (!a) acc.set(film.id, (a = { film, near: new Map(), far: new Map() }));
    const bucket = (dist.get(venue.id) ?? Infinity) <= maxKm ? a.near : a.far;
    const arr = bucket.get(venue.id);
    if (arr) arr.push(s);
    else bucket.set(venue.id, [s]);
  }

  const toRow = (film: Film, m: Map<string, Screening[]>): FilmRow => {
    const vts: VenueTimes[] = [...m.entries()].map(([vid, ss]) => ({ venue: venues.get(vid)!, distanceKm: dist.get(vid) ?? Infinity, screenings: ss.sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }));
    vts.sort((a, b) => a.distanceKm - b.distanceKm);
    const all = vts.flatMap((v) => v.screenings);
    return { film, venues: vts, nearestKm: vts[0]?.distanceKm ?? Infinity, nextAt: all.map((s) => s.startsAt).sort()[0], total: all.length, days: [...new Set(all.map((s) => weekday(s.startsAt)))].sort() };
  };

  const main: FilmRow[] = [], kids: FilmRow[] = [], small: FilmRow[] = [], farther: FilmRow[] = [];
  for (const a of acc.values()) {
    if (a.near.size) {
      const row = toRow(a.film, a.near);
      // no poster anywhere means a film too small for any catalogue: real, but it would leave a
      // hole in a list that is mostly artwork, so these gather in their own group
      if (a.film.isKids) kids.push(row);
      else if (!a.film.posterUrl && !a.film.posterUrls?.length) small.push(row);
      else main.push(row);
    } else if (a.far.size) farther.push(toRow(a.film, a.far));
  }
  const cmp = sorter(q.sort);
  main.sort(cmp);
  kids.sort(cmp);
  small.sort(cmp);
  farther.sort(sorter("dist"));
  return { main, kids, small, farther, dates: [...dates] };
}

function sorter(sort: SortKey) {
  return (a: FilmRow, b: FilmRow): number => {
    if (sort === "time") return a.nextAt.localeCompare(b.nextAt) || a.nearestKm - b.nearestKm;
    if (sort === "imdb") return (b.film.imdbRating ?? -1) - (a.film.imdbRating ?? -1) || a.nearestKm - b.nearestKm;
    return a.nearestKm - b.nearestKm || a.nextAt.localeCompare(b.nextAt);
  };
}

const wdIdx = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function weekday(iso: string): number {
  return WD[wdIdx.format(new Date(iso))] ?? 0;
}

/** Which times to show on a card for one venue: the next screening plus the "prime" one (first at or after 19:45). */
export function pickTimes(ss: Screening[], max = 2): Screening[] {
  if (ss.length <= max) return ss;
  const next = ss[0];
  const prime = ss.find((s) => s !== next && hourOf(s.startsAt) >= 19.75) ?? ss[ss.length - 1];
  const picked = [next, prime].filter((s, i, arr) => arr.indexOf(s) === i).slice(0, max);
  return picked.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
