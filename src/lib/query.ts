/** Filter / sort model shared by the list and the film page. Everything lives in the URL. */
import type { Attr, Film, Screening, Venue } from "./types";
import { distanceKm, type LatLng } from "./geo";
import { TZ, ymdInIsrael, ymdPlusDays } from "./tz";

export type DayKey = "today" | "tomorrow" | "d2" | "d3" | "week";
export type FromKey = "now" | "noon" | "evening" | "night" | "all";
export type RadiusKey = "5" | "15" | "30" | "all";
export type HallKey = "all" | "imax" | "vip" | "4dx" | "cinematheque" | "outdoor";
export type SortKey = "dist" | "time" | "imdb";

export interface Query {
  day: DayKey;
  from: FromKey;
  radius: RadiusKey;
  hall: HallKey;
  sort: SortKey;
}

export const DEFAULTS: Query = { day: "today", from: "now", radius: "15", hall: "all", sort: "dist" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseQuery(sp: SP): Query {
  const day = (["today", "tomorrow", "d2", "d3", "week"] as DayKey[]).includes(one(sp.day) as DayKey) ? (one(sp.day) as DayKey) : DEFAULTS.day;
  let from = (["now", "noon", "evening", "night", "all"] as FromKey[]).includes(one(sp.from) as FromKey) ? (one(sp.from) as FromKey) : undefined;
  if (!from) from = day === "today" ? "now" : "evening";
  if (day !== "today" && from === "now") from = "evening";
  const radius = (["5", "15", "30", "all"] as RadiusKey[]).includes(one(sp.r) as RadiusKey) ? (one(sp.r) as RadiusKey) : DEFAULTS.radius;
  const hall = (["all", "imax", "vip", "4dx", "cinematheque", "outdoor"] as HallKey[]).includes(one(sp.hall) as HallKey) ? (one(sp.hall) as HallKey) : DEFAULTS.hall;
  let sort = (["dist", "time", "imdb"] as SortKey[]).includes(one(sp.sort) as SortKey) ? (one(sp.sort) as SortKey) : DEFAULTS.sort;
  if (day === "week" && sort === "time") sort = "dist";
  return { day, from, radius, hall, sort };
}

/** Serialise a query back to search params, omitting defaults. */
export function queryToSearch(q: Partial<Query>, base: Query = DEFAULTS): string {
  const merged = { ...base, ...q };
  const p = new URLSearchParams();
  if (merged.day !== DEFAULTS.day) p.set("day", merged.day);
  const defaultFrom: FromKey = merged.day === "today" ? "now" : "evening";
  if (merged.from !== defaultFrom) p.set("from", merged.from);
  if (merged.radius !== DEFAULTS.radius) p.set("r", merged.radius);
  if (merged.hall !== DEFAULTS.hall) p.set("hall", merged.hall);
  if (merged.sort !== DEFAULTS.sort) p.set("sort", merged.sort);
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
    case "d2": return `יום ${wdFmt.format(new Date(now.getTime() + 2 * 864e5)).replace(/^יום /, "")}`;
    case "d3": return `יום ${wdFmt.format(new Date(now.getTime() + 3 * 864e5)).replace(/^יום /, "")}`;
  }
}
export const FROM_LABELS: Record<FromKey, string> = { now: "מעכשיו", noon: "צהריים", evening: "ערב", night: "לילה", all: "כל היום" };
export const RADIUS_LABELS: Record<RadiusKey, string> = { "5": "עד 5 ק״מ", "15": "עד 15 ק״מ", "30": "עד 30 ק״מ", all: "כל הארץ" };
export const HALL_LABELS: Record<HallKey, string> = { all: "כל האולמות", imax: "IMAX", vip: "VIP", "4dx": "4DX", cinematheque: "סינמטק", outdoor: "חוץ" };
export const SORT_LABELS: Record<SortKey, string> = { dist: "לפי קרבה", time: "לפי שעה", imdb: "לפי IMDb" };

/* ---- time windows ---- */
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
function hourOf(iso: string): number {
  const [h, m] = hourFmt.format(new Date(iso)).split(":").map(Number);
  return h + m / 60;
}

/** Calendar dates (YYYY-MM-DD, Israel) covered by a day key. */
export function datesFor(day: DayKey, now = new Date()): string[] {
  switch (day) {
    case "today": return [ymdPlusDays(0, now)];
    case "tomorrow": return [ymdPlusDays(1, now)];
    case "d2": return [ymdPlusDays(2, now)];
    case "d3": return [ymdPlusDays(3, now)];
    case "week": return Array.from({ length: 7 }, (_, i) => ymdPlusDays(i, now));
  }
}

export function inTimeWindow(iso: string, from: FromKey, now: Date): boolean {
  if (from === "all") return true;
  if (from === "now") return new Date(iso).getTime() >= now.getTime() - 15 * 60_000; // started up to 15 minutes ago
  const h = hourOf(iso);
  if (from === "noon") return h >= 12 && h < 17;
  if (from === "evening") return h >= 17 && h < 21;
  return h >= 21 || h < 4; // night
}

export function matchesHall(s: Screening, venue: Venue, hall: HallKey): boolean {
  switch (hall) {
    case "all": return true;
    case "cinematheque": return venue.kind === "cinematheque";
    case "outdoor": return s.attrs.includes("outdoor") || venue.kind === "outdoor";
    default: return s.attrs.includes(hall as Attr);
  }
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

/* ---- list assembly ---- */
export interface VenueTimes {
  venue: Venue;
  distanceKm: number;
  screenings: Screening[]; // sorted by time, within the window
}
export interface FilmRow {
  film: Film;
  venues: VenueTimes[]; // sorted by distance
  nearestKm: number;
  nextAt: string;
  total: number; // screenings matching within radius
  days: number[]; // weekdays (week mode)
}

export interface ListResult {
  main: FilmRow[];
  kids: FilmRow[];
  farther: FilmRow[]; // only beyond the radius
  dates: string[];
}

export function buildList(
  films: Map<string, Film>,
  venues: Map<string, Venue>,
  screenings: Screening[],
  q: Query,
  here: LatLng,
  now = new Date(),
): ListResult {
  const dates = new Set(datesFor(q.day, now));
  const maxKm = RADIUS_KM[q.radius];
  const dist = new Map<string, number>();
  for (const v of venues.values()) dist.set(v.id, distanceKm(here, v));

  type Acc = { film: Film; near: Map<string, Screening[]>; far: Map<string, Screening[]> };
  const acc = new Map<string, Acc>();
  for (const s of screenings) {
    if (!dates.has(ymdInIsrael(new Date(s.startsAt)))) continue;
    if (q.day === "today" || q.from !== "now") {
      if (!inTimeWindow(s.startsAt, q.from, now)) continue;
    }
    if (q.day !== "today" && new Date(s.startsAt).getTime() < now.getTime()) continue;
    const venue = venues.get(s.venueId);
    const film = films.get(s.filmId);
    if (!venue || !film || film.isEvent) continue;
    if (!matchesHall(s, venue, q.hall)) continue;
    let a = acc.get(film.id);
    if (!a) acc.set(film.id, (a = { film, near: new Map(), far: new Map() }));
    const bucket = (dist.get(venue.id) ?? Infinity) <= maxKm ? a.near : a.far;
    const arr = bucket.get(venue.id);
    if (arr) arr.push(s);
    else bucket.set(venue.id, [s]);
  }

  const toRow = (film: Film, m: Map<string, Screening[]>): FilmRow => {
    const vts: VenueTimes[] = [...m.entries()].map(([vid, ss]) => ({
      venue: venues.get(vid)!,
      distanceKm: dist.get(vid) ?? Infinity,
      screenings: ss.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    }));
    vts.sort((a, b) => a.distanceKm - b.distanceKm);
    const all = vts.flatMap((v) => v.screenings);
    const nextAt = all.map((s) => s.startsAt).sort()[0];
    return {
      film,
      venues: vts,
      nearestKm: vts[0]?.distanceKm ?? Infinity,
      nextAt,
      total: all.length,
      days: [...new Set(all.map((s) => weekday(s.startsAt)))].sort(),
    };
  };

  const main: FilmRow[] = [];
  const kids: FilmRow[] = [];
  const farther: FilmRow[] = [];
  for (const a of acc.values()) {
    if (a.near.size) {
      const row = toRow(a.film, a.near);
      (a.film.isKids ? kids : main).push(row);
    } else if (a.far.size) {
      farther.push(toRow(a.film, a.far));
    }
  }
  const cmp = sorter(q.sort);
  main.sort(cmp);
  kids.sort(cmp);
  farther.sort(sorter("dist"));
  return { main, kids, farther, dates: [...dates] };
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

/**
 * Which times to show on a card for one venue: the next screening plus the "prime" one
 * (first at or after 20:00), at most `max`. Screenings that carry a hall tag take more room.
 */
export function pickTimes(ss: Screening[], max = 2): Screening[] {
  if (ss.length <= max) return ss;
  const next = ss[0];
  const prime = ss.find((s) => s !== next && hourOf(s.startsAt) >= 19.75) ?? ss[ss.length - 1];
  const picked = [next, prime].filter((s, i, arr) => arr.indexOf(s) === i).slice(0, max);
  return picked.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
