/**
 * Three chains with similar (not identical) JSON feeds: Hot Cinema and Movieland run on the Israeli
 * vendor Modulus, and one request returns the whole chain. Cinema City left Modulus for a Wix site
 * in autumn 2026 and is read from that site's own data collections instead.
 */
import type { AdapterResult, Attr, RawFilm, RawScreening } from "@/lib/types";
import { VENUE_BY_ID, VENUES } from "@/data/venues";
import { localIsoToIso, ymdInIsrael } from "@/lib/tz";
import { getJson, getText } from "./http";

const KIDS_WORDS = ["מדובב", "מדובבת", "g kids", "kids"];

function venuesOf(chain: AdapterResult["chain"]) {
  return VENUES.filter((v) => v.chain === chain);
}

/**
 * Branch ids a feed names that src/data/venues.ts does not know. They are skipped, since a cinema
 * with no name or place cannot be listed, and reported, since a new branch is otherwise invisible.
 */
function unknownBranches() {
  const seen = new Map<string, number>();
  return {
    add: (id: string) => void seen.set(id, (seen.get(id) ?? 0) + 1),
    list: () => [...seen].map(([id, n]) => `unknown branch ${id}, ${n} screenings skipped; add it to src/data/venues.ts`),
  };
}

/* ---------------- Cinema City ---------------- */
/**
 * The old feed, /tickets/Events, now answers with a redirect to the "now playing" page. The new site
 * keeps the schedule in two Wix Data collections that its pages query as an anonymous visitor:
 * SyncPresentations (one row per screening, carrying the ticketing system's own record in
 * payloadJson) and SyncFeatures (one row per film). This asks them the same question, with the
 * same public token the page itself is handed. Tickets are sold on tickets.cinema-city.co.il.
 */
const CC_SITE = "https://www.cinema-city.co.il";
/** Wix's app id for the site's own code (Velo); its visitor token is what reads the collections. */
const CC_VELO_APP_ID = "675bbcef-18d8-41f5-800e-131ec9e08762";
const CC_PAGE = 1000; // Wix Data's largest page

interface CcPresentation {
  externalId: string; dateTime: string; featureId: number; featureName?: string | null;
  venueName?: string | null; venueTypeName?: string | null; soldout?: boolean | null; private?: boolean | null;
  payloadJson?: string | null;
}
interface CcPresentationPayload {
  venueLocationId?: number | null; dubbedLanguageISO?: string | null; subbedLanguageISO?: string | null;
  featureAttributeAbbrvs?: string[] | null;
}
interface CcFeature {
  externalId: string; name?: string | null; additionalName?: string | null; imageWix?: string | null; image?: string | null;
  duration?: number | null; genre?: string[] | null; ratingName?: string | null; synopsis?: string | null;
  trailer?: string | null; categoryName?: string[] | null; director?: string | null; actors?: string | null;
  releaseYear?: number | string | null; payloadJson?: string | { originalLanguageISO?: string | null } | null;
}

/** The anonymous visitor's token for the site's own code, as the page receives it. */
async function ccToken(): Promise<string> {
  const res = await getJson<{ apps?: Record<string, { instance?: string }> }>(`${CC_SITE}/_api/v1/access-tokens`);
  const token = res.apps?.[CC_VELO_APP_ID]?.instance;
  if (!token) throw new Error("Cinema City: no visitor token for the site's data collections");
  return token;
}

/** Every row a Wix Data query matches, a page at a time. */
async function ccQuery<T>(token: string, collection: string, query: Record<string, unknown>): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < 50 * CC_PAGE; offset += CC_PAGE) {
    const page = await getJson<{ dataItems?: { data: T }[]; pagingMetadata?: { hasNext?: boolean } }>(`${CC_SITE}/_api/cloud-data/v2/items/query`, {
      method: "POST",
      headers: {
        authorization: token,
        "content-type": "application/json",
        // a script on the page asking, not a person opening a new page
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify({ dataCollectionId: collection, query: { ...query, paging: { limit: CC_PAGE, offset } } }),
    });
    const items = page.dataItems ?? [];
    out.push(...items.map((d) => d.data));
    if (!page.pagingMetadata?.hasNext || items.length < CC_PAGE) return out;
  }
  throw new Error(`Cinema City: ${collection} did not end after ${out.length} rows`);
}

function parseJson<T>(s: string | T | null | undefined): T | undefined {
  if (!s) return undefined;
  if (typeof s !== "string") return s;
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

/** "wix:image://v1/829266_f5…~mv2.jpg/6698.jpg#originWidth=…" -> a 300x450 crop on Wix's image CDN. */
function wixImageUrl(wix?: string | null): string | undefined {
  const m = /^wix:image:\/\/v1\/([^/#]+)\/([^#]*)/.exec(wix ?? "");
  if (!m) return undefined;
  return `https://static.wixstatic.com/media/${m[1]}/v1/fill/w_300,h_450,al_c,q_90/${m[2] || m[1]}`;
}

/** Cinema City names the hall format on the film ("… - Infinity Vision"), cut short at 40 characters. */
const CC_FORMAT_SUFFIX = /\s*-\s*infinity\s+vi\w*\s*$/i;

export async function scrapeCinemaCity(): Promise<AdapterResult> {
  const token = await ccToken();
  // Rows are replaced as the schedule changes, so the paging order is by the row's own id: two rows
  // never tie on it, which a page boundary between showings at the same minute could otherwise split.
  const rows = await ccQuery<CcPresentation>(token, "SyncPresentations", {
    filter: { businessDate: { $gte: { $date: `${ymdInIsrael()}T00:00:00.000Z` } } },
    sort: [{ fieldName: "_id", order: "ASC" }],
    fields: ["externalId", "dateTime", "featureId", "featureName", "venueName", "venueTypeName", "soldout", "private", "payloadJson"],
  });
  const featureIds = [...new Set(rows.map((r) => String(r.featureId)))];
  const features = new Map<string, CcFeature>();
  if (featureIds.length) {
    const list = await ccQuery<CcFeature>(token, "SyncFeatures", {
      filter: { externalId: { $hasSome: featureIds } },
      fields: ["externalId", "name", "additionalName", "imageWix", "image", "duration", "genre", "ratingName", "synopsis", "trailer", "categoryName", "director", "actors", "releaseYear", "payloadJson"],
    }).catch(() => [] as CcFeature[]); // the schedule stands without the film details
    for (const f of list) features.set(String(f.externalId), f);
  }

  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const seen = new Set<string>();
  const unknown = unknownBranches();
  for (const row of rows) {
    if (row.private || seen.has(row.externalId)) continue;
    seen.add(row.externalId);
    const p = parseJson<CcPresentationPayload>(row.payloadJson);
    const venueId = `cc-${p?.venueLocationId}`;
    if (!p?.venueLocationId) continue;
    if (!VENUE_BY_ID.has(venueId)) { unknown.add(venueId); continue; }
    const id = String(row.featureId);
    const feature = features.get(id);
    const rawName = (feature?.name || row.featureName || "").trim();
    if (!rawName) continue;

    const dubbedLang = p.dubbedLanguageISO || nameDubbedLang(rawName);
    if (!films.has(id)) films.set(id, ccFilm(id, rawName, feature, Boolean(dubbedLang)));

    const attrs: Attr[] = [];
    const format = [row.venueTypeName, row.venueName, ...(p.featureAttributeAbbrvs ?? [])].join(" ");
    if (/\bvip\b/i.test(format)) attrs.push("vip");
    if (/\bimax\b/i.test(format)) attrs.push("imax");
    if (/\b4dx\b/i.test(format)) attrs.push("4dx");
    if (/\bscreen\s*x\b/i.test(format)) attrs.push("screenx");
    if (/\b3d\b/i.test(format) || /(^|\s)3D(\s|$)/.test(rawName)) attrs.push("3d");
    if (dubbedLang) attrs.push("dubbed");
    else if (p.subbedLanguageISO === "he") attrs.push("subbed");
    screenings.push({
      chain: "cinemacity",
      sourceId: row.externalId,
      sourceFilmId: id,
      venueId,
      startsAt: localIsoToIso(row.dateTime),
      attrs,
      dubbedLang: dubbedLang || undefined,
      hall: row.venueName?.trim() || undefined,
      bookingUrl: `https://tickets.cinema-city.co.il/order/${encodeURIComponent(row.externalId)}`,
      soldOut: row.soldout ? true : undefined,
    });
  }
  return { chain: "cinemacity", venues: venuesOf("cinemacity"), films: [...films.values()], screenings, warnings: unknown.list() };
}

function ccFilm(id: string, rawName: string, f: CcFeature | undefined, dubbed: boolean): RawFilm {
  const lower = rawName.toLowerCase();
  const categories = f?.categoryName ?? [];
  const title = rawName
    .replace(CC_FORMAT_SUFFIX, "")
    .replace(/^g\s*kids\s*-\s*/i, "")
    .replace(/\s*-?\s*מדובב(ת)?\s*$/u, "")
    .trim();
  const original = (f?.additionalName ?? "").replace(/\s*-\s*infinity\s+vision\s*$/i, "").trim();
  const year = f?.releaseYear ? Number(f.releaseYear) : undefined;
  const lang = parseJson<{ originalLanguageISO?: string | null }>(f?.payloadJson)?.originalLanguageISO;
  const list = (s?: string | null) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined);
  return {
    chain: "cinemacity",
    sourceId: id,
    title,
    originalTitle: /[A-Za-z]/.test(original) ? original : undefined,
    year: Number.isFinite(year) ? year : undefined,
    runtime: f?.duration && f.duration > 0 ? f.duration : undefined,
    // the category tags (KIDSHOW, SHOW) ride along in the genre list on some rows
    genres: f?.genre?.filter((g) => g && !/^[A-Z]+$/.test(g)),
    ageRating: f?.ratingName && f.ratingName !== "טרם נקבע" ? f.ratingName : undefined,
    synopsis: f?.synopsis?.trim() || undefined,
    trailerUrl: f?.trailer || undefined,
    director: f?.director?.trim() || undefined,
    cast: list(f?.actors),
    // the dubbed print reports the dub as its language
    language: !dubbed && lang ? lang : undefined,
    posterUrl: wixImageUrl(f?.imageWix) ?? (f?.image || undefined),
    isKids: categories.includes("KIDSHOW") || KIDS_WORDS.some((w) => lower.includes(w)),
    // "SHOW" is the chain's own category for stage shows and broadcasts; KIDSHOW is children's films
    isEvent: categories.includes("SHOW") || looksLikeEvent(rawName),
  };
}

/** Dub language from a name like "סקרוג' - מדובב לרוסית" when the record does not say. */
function nameDubbedLang(name: string): string | undefined {
  if (!/מדובב/.test(name)) return undefined;
  if (/לרוסית/.test(name)) return "ru";
  if (/לאנגלית/.test(name)) return "en";
  if (/לערבית/.test(name)) return "ar";
  return "he";
}

/* ---------------- Hot Cinema ---------------- */
interface HotDate {
  Date: string; Hour: string; EventId: string; TheaterId: number;
  DubbedLanguage?: string | null; SubtitledLanguage?: string | null;
  Is3D?: boolean | null; IsAtmos2D?: boolean | null; IsAtmos3D?: boolean | null; IsVIP?: boolean | null; IsPerformance?: boolean | null;
}
interface HotMovie { MovieName: string; MovieId: number; Dates: HotDate[] }
const HOT_NOSTALGIA = /^\s*סינמה\s+נוסטלגיה\s*[-–—:]\s*/u;

export async function scrapeHot(): Promise<AdapterResult> {
  const rows = await getJson<HotMovie[]>("https://hotcinema.co.il/tickets/theaterevents?theaterid=1");
  const posters = await hotPosters(rows[0]?.MovieId).catch(() => new Map<number, string>());
  const films: RawFilm[] = [];
  const screenings: RawScreening[] = [];
  const unknown = unknownBranches();
  for (const row of rows) {
    const id = String(row.MovieId);
    // "סינמה נוסטלגיה - נשק קטלני" is Hot's classics series: a film, under the series' name
    const nostalgia = HOT_NOSTALGIA.test(row.MovieName);
    const title = row.MovieName.replace(HOT_NOSTALGIA, "").replace(/\s*-?\s*מדובב(ת)?\s*$/u, "").trim();
    const anyDubbed = row.Dates.some((d) => d.DubbedLanguage);
    const allPerformance = row.Dates.length > 0 && row.Dates.every((d) => d.IsPerformance);
    // Hot flags these as performances too, as it does stand-up and children's theatre; nobody
    // dubs a stage show, so a dubbed title is a film whatever the flag says
    const filmAfterAll = nostalgia || /מדובב/.test(row.MovieName) || callsItselfAFilm(title);
    films.push({ chain: "hot", sourceId: id, title, posterUrl: realPoster(posters.get(row.MovieId)), isKids: anyDubbed && row.Dates.every((d) => d.DubbedLanguage && langCode(d.DubbedLanguage) === "he"), isEvent: (allPerformance && !filmAfterAll) || looksLikeEvent(title) });
    for (const d of row.Dates) {
      const venueId = `hot-${d.TheaterId}`;
      if (!VENUE_BY_ID.has(venueId)) { unknown.add(venueId); continue; }
      const attrs: Attr[] = [];
      if (d.Is3D) attrs.push("3d");
      if (d.IsAtmos2D || d.IsAtmos3D) attrs.push("atmos");
      if (d.IsVIP) attrs.push("vip");
      if (d.DubbedLanguage) attrs.push("dubbed");
      else if (d.SubtitledLanguage) attrs.push("subbed");
      screenings.push({
        chain: "hot",
        sourceId: d.EventId,
        sourceFilmId: id,
        venueId,
        startsAt: localIsoToIso(d.Date),
        attrs,
        dubbedLang: d.DubbedLanguage ? langCode(d.DubbedLanguage) : undefined,
        bookingUrl: `https://hotcinema.co.il/order?theaterId=${d.TheaterId}&eventId=${d.EventId}`,
      });
    }
  }
  return { chain: "hot", venues: venuesOf("hot"), films, screenings, warnings: unknown.list() };
}

/* ---------------- Movieland ---------------- */
interface MlDate {
  Date: string; Hour: string; EventId: string; TheaterId: number; TheaterName?: string;
  Dubbed?: boolean; ThreeD?: boolean; HebrewSubs?: boolean | null; SiteGroup?: string | null; IsVip?: boolean; BookingNativeUrl?: string;
}
interface MlEvent {
  Name: string; Pic?: string; Genres?: string | null; LengthInMinutes?: string | null; MovieId: number;
  Synopsis?: string | null; ShortSynopsis?: string | null; Trailer?: string | null; Actors?: string | null;
  ReleaseYear?: string | number | null; MovieRating?: { Name?: string } | null; Dates: MlDate[];
}

export async function scrapeMovieland(): Promise<AdapterResult> {
  const rows = await getJson<MlEvent[]>("https://movieland.co.il/api/Events");
  const films: RawFilm[] = [];
  const screenings: RawScreening[] = [];
  const unknown = unknownBranches();
  for (const row of rows) {
    const id = String(row.MovieId);
    const title = row.Name.replace(/\s*-?\s*מדובב(ת)?\s*$/u, "").trim();
    const year = row.ReleaseYear ? Number(row.ReleaseYear) : undefined;
    const runtime = row.LengthInMinutes ? Number(row.LengthInMinutes) : undefined;
    const allDubbedHe = row.Dates.length > 0 && row.Dates.every((d) => mlDubbedLang(d) === "he");
    films.push({
      chain: "movieland",
      sourceId: id,
      title,
      year: Number.isFinite(year) ? year : undefined,
      runtime: Number.isFinite(runtime) ? runtime : undefined,
      genres: row.Genres ? row.Genres.split(",").map((g) => g.trim()).filter(Boolean) : undefined,
      ageRating: row.MovieRating?.Name || undefined,
      synopsis: (row.Synopsis || row.ShortSynopsis || undefined)?.trim(),
      trailerUrl: row.Trailer || undefined,
      cast: row.Actors ? row.Actors.split(",").map((a) => a.trim()).filter(Boolean) : undefined,
      posterUrl: row.Pic ? `https://movieland.co.il/cache/w_300,h_450,mode_crop/${encodeURIComponent(row.Pic)}` : undefined,
      isKids: allDubbedHe,
      isEvent: looksLikeEvent(row.Name),
    });
    for (const d of row.Dates) {
      const venueId = `ml-${d.TheaterId}`;
      const venue = VENUE_BY_ID.get(venueId);
      if (!venue) { unknown.add(venueId); continue; }
      if (!d.BookingNativeUrl) continue;
      const attrs: Attr[] = [];
      const group = d.SiteGroup ?? "";
      const dubbedLang = mlDubbedLang(d);
      const dubbed = Boolean(dubbedLang);
      if (d.ThreeD) attrs.push("3d");
      if (d.IsVip) attrs.push("vip");
      if (venue.kind === "outdoor") attrs.push("outdoor");
      if (dubbed) attrs.push("dubbed");
      else if (d.HebrewSubs || /כתוביות/.test(group)) attrs.push("subbed");
      screenings.push({
        chain: "movieland",
        sourceId: d.EventId,
        sourceFilmId: id,
        venueId,
        startsAt: localIsoToIso(d.Date),
        attrs,
        dubbedLang,
        bookingUrl: d.BookingNativeUrl,
      });
    }
  }
  return { chain: "movieland", venues: venuesOf("movieland"), films, screenings, warnings: unknown.list() };
}

function langCode(hebrewName: string): string {
  const s = hebrewName.trim();
  if (/עברית/.test(s)) return "he";
  if (/רוסית/.test(s)) return "ru";
  if (/אנגלית/.test(s)) return "en";
  if (/ערבית/.test(s)) return "ar";
  return s;
}

/** Movieland marks the dub target in SiteGroup ("מדובב לאנגלית, כתוביות בעברית"). */
function mlDubbedLang(d: MlDate): string | undefined {
  const group = d.SiteGroup ?? "";
  if (/לאנגלית/.test(group)) return "en";
  if (/לרוסית/.test(group)) return "ru";
  if (/מדובב/.test(group) || d.Dubbed) return "he";
  return undefined;
}

const EVENT_WORDS = [
  // A re-release ("הדרן"), an advance screening ("טרום בכורה") and a classics series ("סינמה
  // נוסטלגיה") are all films on a screen, and once hid Avengers: Endgame and Lethal Weapon.
  "סטנדאפ", "הצגה", "הצגת", "מופע", "אופרה", "בלט", "קונצרט", "הופעה", "live", "אולטרה שואו",
  "מחווה", "שעת סיפור", "הרצאה", "party",
  // a festival programme lists its own machinery alongside the films
  "כנס", "סדנה", "סדנת", "פאנל", "טקס", "מפגש יוצרים", "שיח יוצרים", "מסיבת עיתונאים", "אירוע פתיחה",
  "אירוע נעילה", "תערוכה", "מאסטר קלאס", "masterclass", "workshop",
];
/** Hot serves a shared "coming soon" card for films it has no artwork for; that is not a poster. */
const PLACEHOLDER_POSTER = /soonposter|comingsoon|no[-_]?image|default[-_]?poster/i;
const realPoster = (u?: string) => (u && !PLACEHOLDER_POSTER.test(u) ? u : undefined);

/**
 * Hot flags some documentaries as performances, which would hide them from the list. A title that
 * calls itself a film overrides that flag.
 */
function callsItselfAFilm(title: string): boolean {
  return /(^|\s)ה?סרט($|\s|\b)|סרט\s+תיעודי|דוקומנטרי/.test(title);
}

export function looksLikeEvent(title: string): boolean {
  const t = title.toLowerCase();
  return EVENT_WORDS.some((w) => t.includes(w));
}

/** Any Hot movie page embeds `app.movies = [...]` with poster file names for the whole catalogue. */
async function hotPosters(anyMovieId?: number): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!anyMovieId) return map;
  const html = await getText(`https://hotcinema.co.il/movie/${anyMovieId}`);
  const m = /app\.movies\s*=\s*(\[[\s\S]*?\]);/.exec(html);
  if (!m) return map;
  const list = JSON.parse(m[1]) as { ID: number; Poster?: string | null }[];
  for (const x of list) if (x.Poster) map.set(x.ID, `https://hotcinema.co.il/images/${encodeURIComponent(x.Poster)}?w=342&h=491&mode=crop`);
  return map;
}
