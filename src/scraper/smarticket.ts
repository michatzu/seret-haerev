/**
 * SmarTicket is the ticketing system behind most small Israeli venues: a cinematheque in Rosh Pina,
 * a culture hall in Ma'alot, a museum in Haifa. Every tenant answers the same /api/shows with the
 * same JSON, so one parser covers all of them and a new venue costs three lines in the table below.
 *
 * A tenant that does not exist still answers 200, with "לא נמצאה מערכת" in the page title, so a
 * missing venue shows up as an empty list rather than an error.
 */
import type { AdapterResult, RawFilm, RawScreening, Venue } from "@/lib/types";
import { getJson } from "./http";
import { zonedToIso } from "@/lib/tz";
import { looksLikeEvent } from "./modulus";

const CHAIN = "other" as const;

interface SmTenant {
  /** subdomain, or a full host for the few venues on their own domain */
  tenant: string;
  venue: Omit<Venue, "chain">;
  /** which categories are films; undefined means the whole tenant is a cinema */
  categories?: string[];
}

const TENANTS: SmTenant[] = [
  {
    tenant: "roshpinacine",
    venue: { id: "sm-roshpina", name: "סינמטק ראש פינה", city: "ראש פינה", address: "דוד שוב 32", lat: 32.96872, lng: 35.54217, kind: "cinematheque", url: "https://roshpinacine.smarticket.co.il" },
  },
  {
    tenant: "cinema-eilat",
    venue: { id: "sm-eilat", name: "קולנוע אילת", city: "אילת", address: "בית אריק, השחר 1", lat: 29.55805, lng: 34.95175, kind: "boutique", url: "https://cinema-eilat.smarticket.co.il" },
  },
  {
    tenant: "hms",
    venue: { id: "sm-tikotin", name: "קולנוע טיקוטין", city: "חיפה", address: "שדרות הנשיא 89", lat: 32.809349, lng: 34.985385, kind: "boutique", url: "https://hms.smarticket.co.il" },
    categories: ["סרטים", "קולנוע"],
  },
  {
    tenant: "maalot",
    venue: { id: "sm-maalot", name: "סינמה היכל התרבות מעלות", city: "מעלות תרשיחא", address: "קהילת יהדות צרפת 1", lat: 33.01679, lng: 35.28613, kind: "boutique", url: "https://maalot.smarticket.co.il" },
    categories: ["קולנוע"],
  },
  {
    tenant: "savyon",
    venue: { id: "sm-savyon", name: "מרכז התרבות סביון", city: "סביון", address: "נתיב היובל 1", lat: 32.04684, lng: 34.87848, kind: "boutique", url: "https://savyon.smarticket.co.il" },
    categories: ["קולנוע"],
  },
  {
    tenant: "rehovot",
    venue: { id: "sm-rehovot", name: "בית העם רחובות", city: "רחובות", address: "יעקב 2", lat: 31.89416, lng: 34.81089, kind: "boutique", url: "https://rehovot.smarticket.co.il" },
    categories: ["קולנוע"],
  },
  {
    tenant: "ksaba",
    venue: { id: "sm-ksaba", name: "היכל התרבות כפר סבא", city: "כפר סבא", address: "התרבות 6", lat: 32.17539, lng: 34.90796, kind: "boutique", url: "https://ksaba.smarticket.co.il" },
    categories: ["קולנוע"],
  },
  {
    tenant: "raanana",
    venue: { id: "sm-raanana", name: "המשכן לאמנויות הבמה רעננה", city: "רעננה", address: "יד לבנים 1", lat: 32.18425, lng: 34.87196, kind: "boutique", url: "https://raanana.smarticket.co.il" },
    categories: ["קולנוע"],
  },
  {
    tenant: "ramathasharon",
    venue: { id: "sm-ramathasharon", name: "בית יד לבנים רמת השרון", city: "רמת השרון", address: "אוסישקין 41", lat: 32.14607, lng: 34.83877, kind: "boutique", url: "https://ramathasharon.smarticket.co.il" },
    categories: ["קולנוע"],
  },
  {
    tenant: "hhn",
    venue: { id: "sm-nahariya", name: "היכל התרבות נהריה", city: "נהריה", address: "הגעתון 19", lat: 33.00787, lng: 35.09523, kind: "boutique", url: "https://hhn.smarticket.co.il" },
    categories: ["קולנוע"],
  },
];

interface SmEvent {
  id: number;
  show_date?: string;
  show_time?: string;
  duration?: number;
  event_place?: string;
  permalink?: string;
  tickets_available?: boolean;
  visibility?: boolean;
}
interface SmShow {
  id: number;
  title?: string;
  category?: string | null;
  image?: string | null;
  brief?: string | null;
  permalink?: string;
  events?: SmEvent[];
}

const DAYS = 45;

async function scrapeTenant(t: SmTenant): Promise<AdapterResult> {
  const host = t.tenant.includes(".") ? t.tenant : `${t.tenant}.smarticket.co.il`;
  const shows = await getJson<SmShow[]>(`https://${host}/api/shows`);
  if (!Array.isArray(shows)) throw new Error(`${t.tenant}: unexpected payload`);

  const venue: Venue = { chain: CHAIN, ...t.venue };
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const now = Date.now();
  const horizon = now + DAYS * 864e5;

  for (const show of shows) {
    const title = (show.title ?? "").replace(/\s+/g, " ").trim();
    if (!title) continue;
    // a mixed venue sells theatre and concerts through the same system
    if (t.categories && !t.categories.includes(show.category ?? "")) continue;
    const clean = cleanTitle(title);
    if (!clean) continue;

    const filmId = `sm-${t.tenant}-${show.id}`;
    for (const e of show.events ?? []) {
      if (e.visibility === false) continue;
      const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.show_date ?? "");
      const hm = /^(\d{1,2}):(\d{2})/.exec(e.show_time ?? "");
      if (!d || !hm) continue;
      const startsAt = zonedToIso(+d[1], +d[2], +d[3], +hm[1], +hm[2]);
      const at = Date.parse(startsAt);
      if (!Number.isFinite(at) || at < now - 3600_000 || at > horizon) continue;

      if (!films.has(filmId)) {
        films.set(filmId, {
          chain: CHAIN,
          sourceId: filmId,
          title: clean,
          runtime: e.duration && e.duration > 30 ? e.duration : undefined,
          posterUrl: show.image ? `https://${host}/uploads/${show.image}` : undefined,
          synopsis: show.brief ? show.brief.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 900) : undefined,
          isEvent: looksLikeEvent(title),
        });
      }
      screenings.push({
        chain: CHAIN,
        sourceId: `sm-${t.tenant}-${e.id}`,
        sourceFilmId: filmId,
        venueId: venue.id,
        startsAt,
        attrs: [],
        bookingUrl: `https://${host}${e.permalink ?? `/show/${show.id}`}`,
        soldOut: e.tickets_available === false || undefined,
      });
    }
  }
  return { chain: CHAIN, venues: screenings.length ? [venue] : [], films: [...films.values()], screenings };
}

/** These listings append their own labels to a title: "X | טרום בכורה", "X – מועדון קולנוע". */
function cleanTitle(t: string): string {
  return t
    .replace(/\s*[|–—-]\s*(טרום בכורה|בכורה|מועדון קולנוע|קולנוע שישי נשי|הקרנה חגיגית|במסגרת.*|מפגש עם.*|בהשתתפות.*|שיח.*)$/u, "")
    .replace(/^\s*(דוקו ישראלי|אפוס|סינמה ישראלית|מועדון קולנוע|קולנוע ישראלי)\s*:\s*/u, "")
    .replace(/^\s*(סרט|הסרט|קולנוע)\s*:\s*/u, "")
    .replace(/^[״"'׳'']+|[״"'׳'']+$/gu, "")
    .replace(/\s*\((מדובב|מדובבת)\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s|–—-]+|[\s|–—-]+$/g, "")
    .trim();
}

export async function scrapeSmarticket(): Promise<AdapterResult> {
  const parts = await Promise.allSettled(TENANTS.map(scrapeTenant));
  for (const [i, p] of parts.entries()) {
    if (p.status === "rejected") console.warn(`  smarticket ${TENANTS[i].tenant} failed:`, p.reason instanceof Error ? p.reason.message : p.reason);
  }
  const ok = parts.filter((p): p is PromiseFulfilledResult<AdapterResult> => p.status === "fulfilled").map((p) => p.value);
  if (!ok.length) throw new Error("every smarticket tenant failed");
  return {
    chain: CHAIN,
    venues: ok.flatMap((r) => r.venues),
    films: ok.flatMap((r) => r.films),
    screenings: ok.flatMap((r) => r.screenings),
  };
}

export const SMARTICKET_VENUE_IDS = TENANTS.map((t) => t.venue.id);