/**
 * Three chains run on the Israeli vendor Modulus with similar (not identical) JSON feeds:
 * Cinema City, Hot Cinema and Movieland. One request returns the whole chain.
 */
import type { AdapterResult, Attr, RawFilm, RawScreening } from "@/lib/types";
import { VENUE_BY_ID, VENUES } from "@/data/venues";
import { dmyToIso, localIsoToIso } from "@/lib/tz";
import { getJson, getText } from "./http";

const KIDS_WORDS = ["מדובב", "מדובבת", "g kids", "kids"];

function venuesOf(chain: AdapterResult["chain"]) {
  return VENUES.filter((v) => v.chain === chain);
}

/* ---------------- Cinema City ---------------- */
interface CcDate { Date: string; Hour: string; EventId: string; TheaterId: number }
interface CcEvent { Name: string; Pic?: string; ExportCode: number; Dates: CcDate[] }

export async function scrapeCinemaCity(): Promise<AdapterResult> {
  const rows = await getJson<CcEvent[]>("https://www.cinema-city.co.il/tickets/Events");
  const films: RawFilm[] = [];
  const screenings: RawScreening[] = [];
  for (const row of rows) {
    const id = String(row.ExportCode);
    const rawName = row.Name.trim();
    const lower = rawName.toLowerCase();
    const dubbed = lower.includes("מדובב");
    const title = rawName.replace(/^g\s*kids\s*-\s*/i, "").replace(/\s*-?\s*מדובב(ת)?\s*$/u, "").trim();
    films.push({
      chain: "cinemacity",
      sourceId: id,
      title,
      posterUrl: row.Pic ? `https://cdn.modulus.co.il/fetch/cinemacity/w_300,h_450,mode_crop,quality_90/http://80.178.112.171/images/${encodeURIComponent(row.Pic)}` : undefined,
      isKids: KIDS_WORDS.some((w) => lower.includes(w)),
      isEvent: looksLikeEvent(rawName),
    });
    for (const d of row.Dates) {
      const venueId = `cc-${d.TheaterId}`;
      if (!VENUE_BY_ID.has(venueId)) continue;
      const attrs: Attr[] = dubbed ? ["dubbed"] : [];
      screenings.push({
        chain: "cinemacity",
        sourceId: d.EventId,
        sourceFilmId: id,
        venueId,
        startsAt: dmyToIso(d.Date),
        attrs,
        dubbedLang: dubbed ? "he" : undefined,
        bookingUrl: `https://www.cinema-city.co.il/order/?eventID=${d.EventId}`,
      });
    }
  }
  return { chain: "cinemacity", venues: venuesOf("cinemacity"), films, screenings };
}

/* ---------------- Hot Cinema ---------------- */
interface HotDate {
  Date: string; Hour: string; EventId: string; TheaterId: number;
  DubbedLanguage?: string | null; SubtitledLanguage?: string | null;
  Is3D?: boolean | null; IsAtmos2D?: boolean | null; IsAtmos3D?: boolean | null; IsVIP?: boolean | null; IsPerformance?: boolean | null;
}
interface HotMovie { MovieName: string; MovieId: number; Dates: HotDate[] }

export async function scrapeHot(): Promise<AdapterResult> {
  const rows = await getJson<HotMovie[]>("https://hotcinema.co.il/tickets/theaterevents?theaterid=1");
  const posters = await hotPosters(rows[0]?.MovieId).catch(() => new Map<number, string>());
  const films: RawFilm[] = [];
  const screenings: RawScreening[] = [];
  for (const row of rows) {
    const id = String(row.MovieId);
    const title = row.MovieName.replace(/\s*-?\s*מדובב(ת)?\s*$/u, "").trim();
    const anyDubbed = row.Dates.some((d) => d.DubbedLanguage);
    const allPerformance = row.Dates.length > 0 && row.Dates.every((d) => d.IsPerformance);
    films.push({ chain: "hot", sourceId: id, title, posterUrl: realPoster(posters.get(row.MovieId)), isKids: anyDubbed && row.Dates.every((d) => d.DubbedLanguage && langCode(d.DubbedLanguage) === "he"), isEvent: (allPerformance && !callsItselfAFilm(title)) || looksLikeEvent(title) });
    for (const d of row.Dates) {
      const venueId = `hot-${d.TheaterId}`;
      if (!VENUE_BY_ID.has(venueId)) continue;
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
  return { chain: "hot", venues: venuesOf("hot"), films, screenings };
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
      if (!venue || !d.BookingNativeUrl) continue;
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
  return { chain: "movieland", venues: venuesOf("movieland"), films, screenings };
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
  "סטנדאפ", "הצגה", "הצגת", "מופע", "אופרה", "בלט", "קונצרט", "הופעה", "live", "הדרן", "אולטרה שואו",
  "מחווה", "שעת סיפור", "הרצאה", "סינמה נוסטלגיה", "טרום בכורה", "party",
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
