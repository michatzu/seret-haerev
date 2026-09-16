/**
 * Pop-up and one-off screenings: venues that are not cinemas and appear for a season or a single
 * night (Gan HaPisga in Old Jaffa, Beit Radical, Levontin 7 and friends).
 *
 * Two sources, deliberately different in kind:
 *  1. Tel Aviv municipality's own events service. Hebrew titles, exact times, authoritative for
 *     municipal venues. A season is published as ONE record whose description lists every night,
 *     so the series text is expanded into individual screenings.
 *  2. Secret Tel Aviv's public iCal feed. One request, English titles, covers the independent
 *     venues the municipality never lists.
 *
 * Both are undocumented third-party endpoints. Either failing is reported and skipped, never fatal.
 */
import type { AdapterResult, RawFilm, RawScreening, Venue } from "@/lib/types";
import { getText } from "./http";
import { zonedToIso } from "@/lib/tz";
import { shortHash } from "@/lib/text";
import { geocode, saveGeocodeCache } from "./geocode";
import { scrapeFestivals } from "./festivals";

const CHAIN = "other" as const;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/* ------------------------------------------------------------------ venues */

/**
 * Curated registry of pop-up venues. Coordinates are hand-checked: the municipality publishes
 * Israeli grid coordinates and the iCal feed publishes none, and there are few enough venues
 * that a lookup table beats a projection library or a geocoding dependency.
 * `match` is tested against the venue name as each source writes it.
 */
interface PopupVenue extends Venue { match: RegExp }
const POPUP_VENUES: PopupVenue[] = [
  { id: "pop-hapisga", chain: CHAIN, name: "גן הפסגה", city: "תל אביב", address: "מפרץ שלמה 8, יפו העתיקה", lat: 32.05315, lng: 34.75225, kind: "outdoor", url: "https://www.tel-aviv.gov.il", match: /gan ha.?pisga|hapisga cinema|גן הפסגה|קולנוע הפסגה/i },
  { id: "pop-radical", chain: CHAIN, name: "בית רדיקל", city: "תל אביב", address: "מרחב 3426, התחיה 26", lat: 32.05672, lng: 34.76249, kind: "boutique", url: "https://radical.org.il", match: /beit radical|בית רדיקל/i },
  { id: "pop-levontin", chain: CHAIN, name: "לבונטין 7", city: "תל אביב", address: "לבונטין 7", lat: 32.06297, lng: 34.77557, kind: "boutique", url: "https://levontin7.com", match: /levontin ?7|לבונטין ?7/i },
  { id: "pop-tarab", chain: CHAIN, name: "טראב", city: "תל אביב", address: "הרצל 84", lat: 32.05614, lng: 34.76889, kind: "boutique", match: /\btarab\b|טראב/i },
  { id: "pop-matmon", chain: CHAIN, name: "מטמון", city: "תל אביב", address: "הרצל 70", lat: 32.05733, lng: 34.76986, kind: "boutique", match: /\bmatmon\b|מטמון/i },
  { id: "pop-hameretz2", chain: CHAIN, name: "המרץ 2", city: "תל אביב", address: "המרץ 2", lat: 32.05585, lng: 34.77739, kind: "boutique", match: /hameretz ?2|המרץ ?2/i },
  { id: "pop-purple", chain: CHAIN, name: "Purple House", city: "תל אביב", address: "שדרות ירושלים 32, יפו", lat: 32.05306, lng: 34.75664, kind: "boutique", match: /purple house/i },
];

const findVenue = (name: string): PopupVenue | undefined => POPUP_VENUES.find((v) => v.match.test(name));
/** Drop the matcher: it is scraper-side only and must not reach the snapshot. */
function toVenue(v: PopupVenue): Venue {
  const { id, chain, name, city, address, lat, lng, kind, url } = v;
  return { id, chain, name, city, address, lat, lng, kind, url };
}

/**
 * A venue the feed names but the table does not know: look it up once and keep it, so a one-off
 * screening in a bar still lands on the map. The street address is only ever a lookup hint — the
 * venue keeps the name the feed gave it, because "\u05e4\u05e2\u05de\u05d5\u05e0\u05d9\u05ea 9" is not a name anybody recognises.
 * Places that cannot be resolved are skipped rather than guessed at.
 */
const resolved = new Map<string, Venue | null>();
const looksLikeAddress = (s: string) => /^[\u05d0-\u05ea\w'"\u05f3\u05f4.\- ]{2,40}\s+\d{1,4}$/.test(s.trim()) || /^\d/.test(s.trim());

async function resolveVenue(rawName: string, address = "", city = "\u05ea\u05dc \u05d0\u05d1\u05d9\u05d1"): Promise<Venue | null> {
  const known = findVenue(rawName) ?? (address ? findVenue(address) : undefined);
  if (known) return toVenue(known);

  const name = rawName.replace(/\s+/g, " ").replace(/^[\s,\-\u2013\u2014]+|[\s,\-\u2013\u2014]+$/g, "").trim();
  if (name.length < 2 || name.length > 60) return null;
  if (/^\d+$/.test(name) || /\u05de\u05e1\u05e4\u05e8 \u05de\u05d9\u05e7\u05d5\u05de\u05d9\u05dd/.test(name)) return null; // "\u05de\u05e1\u05e4\u05e8 \u05de\u05d9\u05e7\u05d5\u05de\u05d9\u05dd \u05d1\u05e8\u05d7\u05d1\u05d9 \u05d9\u05e4\u05d5" is not a place
  const key = `${name}|${address}|${city}`;
  if (resolved.has(key)) return resolved.get(key)!;

  // the name first, then the address as a fallback query; either way the name is what we display
  const hit = (await geocode(name, city)) ?? (address && !looksLikeAddress(name) ? null : address ? await geocode(address, city) : null);
  const venue = hit
    ? { id: `pop-${shortHash(`${name}|${city}`.toLowerCase())}`, chain: CHAIN, name, city, address: address || undefined, lat: hit.lat, lng: hit.lng, kind: "boutique" as const }
    : null;
  resolved.set(key, venue);
  return venue;
}

/* ------------------------------------------------- Tel Aviv municipality */

const TLV_URL = "https://www.tel-aviv.gov.il/_vti_bin/TlvSP2013PublicSite/TlvListUtils.svc/GetEvBenList";

interface TlvItem { Fields: { InternalName: string; Value: string | null }[] }

/**
 * The service rejects an incomplete body with an empty array rather than an error, and several
 * fields are load-bearing: the SharePoint list identity in `srch_BenChldDS`, the benefit content
 * types in `srch_exceptions`, and the `""`-not-`[]` spellings below. Only the dates are ours.
 */
function tlvBody(days: number) {
  const now = new Date();
  return {
    srch_txt: "",
    srch_dateStart: now.toISOString(),
    srch_dateEnd: new Date(now.getTime() + days * 864e5).toISOString(),
    srch_ctAll: ["סוג תוכן לאירועים", "סוג תוכן אירוע WITH"],
    srch_exceptions: ["סוג תוכן להטבות", "סוג תוכן הטבות עם רישום", "סוג תוכן הטבות עם בתשלום", "סוג תוכן הטבות עסקיות"],
    srch_orderByFields: ["TlvOrder", "TlvStartDate"],
    srch_BenChldDS: {
      Fields: null,
      ItemdIds: null,
      ListContentTypes: ["פריט", "תיקיה"],
      ListId: "0145e0d6-4bae-4831-afcf-b51d66f7ccb3",
      SiteId: "24aa409e-01ed-482e-b0ed-1956972addb1",
      ViewId: "b92fc306-15f4-4727-ae6b-24188b1f9376",
      WebId: "3af57d92-807c-43c5-8d5f-6fd455eb2776",
    },
    srch_AcsID: "", srch_Omp: "", srch_audID: "", srch_iccID: "", srch_locID: "",
    srch_lstTktCtgr: "1,8", srch_paramsStrForCache: "VisitorsEventsPagesEvents.aspxIccID-1DOfalseFreefalseDtRng-1eab",
    srch_bsCtgry: [], srch_crmIntsID: [], srch_specialEvID: [], srch_toIntsID: [],
    srch_delivery: false, srch_digiOnly: false, srch_evening: false, srch_free: false,
    srch_isBusiness: false, srch_morning: false, srch_noon: false, srch_showBoundBenefits: false,
    srch_showInLobby: false, srch_tickets: false,
    srch_myLat: 0, srch_myLon: 0, srch_radius: 500, srch_totalItemsLoad: 3000,
  };
}

const field = (it: TlvItem, name: string): string => it.Fields.find((f) => f.InternalName === name)?.Value ?? "";
const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;|‏|‎|​/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** "רביעי, 16.9.26 ב-21:00 - האלמנט החמישי | The Fifth Element - חוגגים 30 שנה" */
const SERIES_LINE = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s*ב[-\s‑-―]*\s*(\d{1,2}):(\d{2})\s*[-–—]\s*([^\n]+?)(?=\s{2,}|\s+(?:יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\s*,|$)/g;

/** A screening line's film title: drop the English half after "|" and any trailing editorial note. */
function cleanSeriesTitle(raw: string): { title: string; original?: string } | null {
  let s = raw.trim().replace(/\s+/g, " ");
  const bar = s.split("|");
  const original = bar[1]?.split(/\s+[-–—]\s+/)[0].trim();
  s = bar[0].trim();
  s = s.replace(/^קולנוע הפסגה\s+(לילדים ולילדות|לילדים)\s*:\s*/, "");
  s = s.replace(/\s+[-–—]\s+(חוגגים|הקרנה חגיגית|ערב מחווה|מפגש|בהשתתפות).*$/, "").trim();
  if (s.length < 2 || s.length > 90) return null;
  return { title: s, original: original && /[A-Za-z]/.test(original) ? original : undefined };
}

/**
 * A municipal event title is written for a listings page, not for us:
 * "קולנוע הפסגה - האלמנט החמישי", "הקרנת הסרט פוטו פרג׳ ושיח עם הבמאי",
 * "קולנוע הפסגה: 20 שנה לסרט מכוניות". Peel the series prefix and the editorial tail.
 */
/** Quote characters that wrap a title; a lone geresh inside a word (סנאץ׳) must survive. */
const QUOTES = "\"'\u05f3\u05f4\u2018\u2019\u201c\u201d";

function cleanEventTitle(raw: string): string | null {
  let s = raw.replace(/\s+/g, " ").trim();
  const unquote = (x: string) => { let t = x.trim(); while (t.length > 2 && QUOTES.includes(t[0]) && QUOTES.includes(t[t.length - 1])) t = t.slice(1, -1).trim(); return t; };
  s = unquote(s);
  s = s.replace(/^(?:קולנוע\s+הפסגה|קולנוע\s+בגן|סרטי\s+קיץ)\s*(?:לילדים\s+ולילדות|לילדים)?\s*[-–—:]\s*/, "");
  s = s.replace(/^הקרנ(?:ת|ה\s+של)\s+(?:הסרט|סרט|הסרטים)\s+/, "");
  s = s.replace(/^(?:סרט|הסרט)\s*:\s*/, "");
  // a series label in front of the film: "שישי מהסרטים: דויד", "מוצ״ש קולנועי: ..."
  s = s.replace(/^([^:]{3,32}):\s*(?=\S)/u, (m, label: string) =>
    /קולנוע|סרטים|מועדון|סדרת|ערב|מוצ|שישי|פסטיבל|הקרנ/.test(label) ? "" : m);
  // "20 שנה לסרט מכוניות" / "חוגגים 30 שנה לסרט סנאץ"
  s = s.replace(/^[\s:\-\u2013\u2014]+/, ""); // "הקרנת סרט : X" leaves a stray colon
  const anniversary = /(?:חוגגים\s+)?\d+\s+שנה\s+ל(?:סרט\s+|הסרט\s+)?(.+)$/.exec(s);
  if (anniversary) s = anniversary[1];
  s = s.replace(/\s*[-–—]\s*(?:חוגגים|ערב|מפגש|בהשתתפות|הקרנה|שיח|לרגל|במסגרת|מופע)[\sולב].*$/u, "");
  s = s.replace(/\s+ב(?:מועדון|מסגרת|סדרת)\s+.*$/u, "");
  s = s.replace(/\s+ו?שיח\s+עם\s+הבמאי.*$/, "");
  s = unquote(s.replace(/[!\s]*[-–—:]?[!\s]*$/, ""));
  if (s.length < 2 || s.length > 90) return null;
  if (/^קולנוע\s+הפסגה/.test(s)) return null; // the umbrella record, not a film
  return s;
}

/** Is this municipal event about film at all? The interests field lumps theatre in with cinema. */
function looksLikeCinema(it: TlvItem): boolean {
  const interests = field(it, "TlvFieldsOfInterests");
  const title = field(it, "Title");
  const blob = `${title} ${stripTags(field(it, "TlvSummary"))}`;
  if (/תאטרון|תיאטרון|הצגה|סדנ|הרצאה|מופע/.test(title) && !/קולנוע|הקרנ|סרט/.test(title)) return false;
  return /קולנוע/.test(interests) && /קולנוע|הקרנ|הסרט|סרטים/.test(blob);
}

async function fromMunicipality(days: number): Promise<{ venues: Venue[]; films: RawFilm[]; screenings: RawScreening[] }> {
  const text = await getText(TLV_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "user-agent": UA },
    body: JSON.stringify(tlvBody(days)),
  }, 45_000);
  const items = JSON.parse(text) as TlvItem[];

  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const venues = new Map<string, Venue>();
  const taken = new Set<string>();
  const now = Date.now();
  const horizon = now + days * 864e5;

  const add = (v: Venue, startsAt: string, title: string, original: string | undefined, synopsis: string, url: string, outdoor: boolean, sourceId: string) => {
    const t = new Date(startsAt).getTime();
    if (!Number.isFinite(t) || t < now - 6 * 3600_000 || t > horizon) return;
    const slot = `${v.id}|${startsAt}`;
    if (taken.has(slot)) return;
    taken.add(slot);
    const filmId = `tlv-${shortHash(title)}`;
    if (!films.has(filmId)) films.set(filmId, { chain: CHAIN, sourceId: filmId, title, originalTitle: original, synopsis: synopsis || undefined, isEvent: false });
    screenings.push({ chain: CHAIN, sourceId, sourceFilmId: filmId, venueId: v.id, startsAt, attrs: outdoor ? ["outdoor"] : [], bookingUrl: url });
  };

  // An event published in its own right names the film; a season description only fills the nights
  // the municipality did not publish separately, so the event pass runs first.
  for (const pass of ["event", "series"] as const) {
    for (const it of items) {
      if (!looksLikeCinema(it)) continue;
      const loc = field(it, "TlvCityLocation");
      const v = (await resolveVenue(loc, field(it, "TlvAddress1"))) ?? (findVenue(field(it, "Title")) ? toVenue(findVenue(field(it, "Title"))!) : null);
      if (!v) continue; // a place we cannot put on the map is worse than no listing
      venues.set(v.id, v);
      const outdoor = v.kind === "outdoor";
      const itemId = field(it, "ListItemID");
      const url = `https://www.tel-aviv.gov.il/Pages/MainItemPage.aspx?WebID=${field(it, "WebID")}&ListID=${field(it, "ListID")}&ItemID=${itemId}`;
      const summary = stripTags(field(it, "TlvSummary"));

      if (pass === "event") {
        const d = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4}),\s*(\d{1,2}):(\d{2})/.exec(field(it, "TlvStartDate"));
        const title = cleanEventTitle(field(it, "Title"));
        if (!d || !title) continue;
        const year = Number(d[3].length === 2 ? `20${d[3]}` : d[3]);
        add(v, zonedToIso(year, +d[2], +d[1], +d[4], +d[5]), title, undefined, summary, url, outdoor, `${itemId}-${field(it, "TlvStartDate")}`);
      } else {
        for (const m of stripTags(field(it, "Comments")).matchAll(SERIES_LINE)) {
          const parsed = cleanSeriesTitle(m[6]);
          if (!parsed) continue;
          const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
          add(v, zonedToIso(year, +m[2], +m[1], +m[4], +m[5]), parsed.title, parsed.original, summary, url, outdoor, `${itemId}-${m[1]}.${m[2]}-${m[4]}`);
        }
      }
    }
  }
  return { venues: [...venues.values()], films: [...films.values()], screenings };
}

/* --------------------------------------------------- Secret Tel Aviv iCal */

const ICAL_URL = "https://www.secrettelaviv.com/?ical=1";

/** Unfold RFC 5545 continuation lines and unescape the text values we read. */
function icalEvents(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const unfolded: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += line.slice(1);
    else unfolded.push(line);
  }
  const out: Record<string, string>[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of unfolded) {
    if (line.startsWith("BEGIN:VEVENT")) cur = {};
    else if (line.startsWith("END:VEVENT")) { if (cur) out.push(cur); cur = null; }
    else if (cur) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const key = line.slice(0, i).split(";")[0].toUpperCase();
      const params = line.slice(0, i);
      const value = line.slice(i + 1).replace(/\\n/g, " ").replace(/\\,/g, ",").replace(/\;/g, ";").replace(/\\\\/g, "\\");
      cur[key] = value;
      if (key === "DTSTART") cur.DTSTART_PARAMS = params;
    }
  }
  return out;
}

/** "20260916T210000" (with TZID) or "20260916T190000Z". */
function icalToIso(value: string, params: string): string | null {
  const utc = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (utc) return new Date(Date.UTC(+utc[1], +utc[2] - 1, +utc[3], +utc[4], +utc[5], +utc[6])).toISOString();
  const local = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (local) return zonedToIso(+local[1], +local[2], +local[3], +local[4], +local[5]);
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly && !/VALUE=DATE/i.test(params)) return zonedToIso(+dateOnly[1], +dateOnly[2], +dateOnly[3], 20, 0);
  return null;
}

/** A screening, not a themed party. Beware "Live Cinematic Techno" and "Wines From Movies". */
const SCREENING_RE = /\b(screening|sceening|film screening|movie night|cinema)\b/i;
const NOT_SCREENING_RE = /\b(techno|dj|party|wine|tasting|quiz|karaoke|comedy night|open mic)\b/i;

/** "Tapes of Revolution - Screening @ Beit Radical -  - 23/09/2026 - 9:00 pm" -> title + venue. */
function parseSummary(summary: string): { title: string; venue: string } | null {
  const at = summary.lastIndexOf("@");
  if (at < 0) return null;
  let title = summary.slice(0, at).trim();
  const venue = summary.slice(at + 1).split(/\s+-\s{2,}|\s+-\s+\d{1,2}\/\d{1,2}\/\d{4}/)[0].replace(/\s*-\s*$/, "").trim();
  title = title.replace(/\s*[-–—]\s*(film\s+)?(screening|sceening)\s*$/i, "").trim();
  title = title.replace(/^.*?free outdoor screening of\s+/i, "").trim();
  title = title.replace(/\s*[-–—]\s*$/, "").trim();
  if (!title || !venue) return null;
  return { title, venue };
}

async function fromSecretTelAviv(days: number): Promise<{ venues: Venue[]; films: RawFilm[]; screenings: RawScreening[] }> {
  const text = await getText(ICAL_URL, { headers: { "user-agent": UA, accept: "text/calendar,*/*" } }, 45_000);
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const venues = new Map<string, Venue>();
  const now = Date.now();
  const horizon = now + days * 864e5;

  for (const ev of icalEvents(text)) {
    const summary = ev.SUMMARY ?? "";
    if (!SCREENING_RE.test(summary) || NOT_SCREENING_RE.test(summary)) continue;
    const parsed = parseSummary(summary);
    if (!parsed) continue;
    const v = (await resolveVenue(parsed.venue)) ?? (findVenue(summary) ? toVenue(findVenue(summary)!) : null);
    if (!v) continue;
    const startsAt = ev.DTSTART ? icalToIso(ev.DTSTART, ev.DTSTART_PARAMS ?? "") : null;
    if (!startsAt) continue;
    const t = new Date(startsAt).getTime();
    if (!Number.isFinite(t) || t < now - 6 * 3600_000 || t > horizon) continue;
    venues.set(v.id, v);
    const filmId = `stlv-${shortHash(parsed.title.toLowerCase())}`;
    if (!films.has(filmId)) {
      films.set(filmId, { chain: CHAIN, sourceId: filmId, title: parsed.title, synopsis: ev.DESCRIPTION ? ev.DESCRIPTION.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600) : undefined, isEvent: false });
    }
    screenings.push({ chain: CHAIN, sourceId: `stlv-${ev.UID ?? `${filmId}-${startsAt}`}`, sourceFilmId: filmId, venueId: v.id, startsAt, attrs: v.kind === "outdoor" ? ["outdoor"] : [], bookingUrl: ev.URL || "https://www.secrettelaviv.com/" });
  }
  return { venues: [...venues.values()], films: [...films.values()], screenings };
}

/* ------------------------------------------------------------------ entry */

const DAYS = 30;

export async function scrapePopup(): Promise<AdapterResult> {
  const [muni, stlv] = await Promise.allSettled([fromMunicipality(DAYS), fromSecretTelAviv(DAYS)]);
  await saveGeocodeCache();
  if (muni.status === "rejected" && stlv.status === "rejected") throw muni.reason;
  for (const r of [muni, stlv]) {
    if (r.status === "rejected") console.warn("  popup source failed:", r.reason instanceof Error ? r.reason.message : r.reason);
  }
  const fests = await scrapeFestivals().catch((e) => {
    console.warn("  festivals failed:", e instanceof Error ? e.message : e);
    return { venues: [], films: [], screenings: [] };
  });
  const parts = [...[muni, stlv].filter((r) => r.status === "fulfilled").map((r) => r.value), fests];

  const venues = new Map<string, Venue>();
  const films = new Map<string, RawFilm>();
  const seen = new Set<string>();
  const screenings: RawScreening[] = [];
  for (const p of parts) {
    for (const v of p.venues) venues.set(v.id, v);
    for (const f of p.films) films.set(f.sourceId, f);
    for (const s of p.screenings) {
      // the municipality wins on a clash: same venue and start time, Hebrew title
      const key = `${s.venueId}|${s.startsAt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      screenings.push(s);
    }
  }
  return { chain: CHAIN, venues: [...venues.values()], films: [...films.values()], screenings };
}
