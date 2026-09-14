/** Cinematheques publish plain HTML schedules; each one gets a small parser. */
import type { AdapterResult, RawFilm, RawScreening, Venue } from "@/lib/types";
import { VENUE_BY_ID } from "@/data/venues";
import { localIsoToIso, ymdPlusDays } from "@/lib/tz";
import { getText, pool } from "./http";
import { shortHash } from "@/lib/text";

/* ---------------- Jerusalem (Drupal calendar, one page per day) ---------------- */
const JLM_VENUE = "cinematheque-jlm";
const JLM_ITEM =
  /<span class="date-display-single"[^>]*content="([^"]+)"[^>]*>[\s\S]*?<button class="toptix-purchase"\s+data-url="([^"]+)"\s+data-event-id="(\d+)"[^>]*?data-event-node="(\d+)"[^>]*data-event-title="([^"]*)"/g;

export async function scrapeJerusalemCinematheque(days = 8): Promise<AdapterResult> {
  const venue = VENUE_BY_ID.get(JLM_VENUE)!;
  const films = new Map<string, RawFilm>();
  const titleToFilm = new Map<string, string>(); // the same film screens on several nodes
  const screenings: RawScreening[] = [];
  const dates = Array.from({ length: days }, (_, i) => ymdPlusDays(i));
  const results = await pool(dates, 3, async (date) => {
    const html = await getText(`https://jer-cin.org.il/he/article/4285?date=${date}`);
    for (const m of html.matchAll(JLM_ITEM)) {
      const [, iso, url, eventId, nodeId, rawTitle] = m;
      const title = decode(rawTitle).trim();
      if (!title || !iso.startsWith(date)) continue;
      // the node id is the film's own page, which is where its poster lives
      const filmId = `jlm-node-${nodeId}`;
      const byTitle = titleToFilm.get(title.toLowerCase());
      const id = byTitle ?? filmId;
      if (!byTitle) titleToFilm.set(title.toLowerCase(), filmId);
      if (!films.has(id)) films.set(id, { chain: "cinematheque", sourceId: id, title });
      screenings.push({
        chain: "cinematheque",
        sourceId: `jlm-${eventId}`,
        sourceFilmId: id,
        venueId: JLM_VENUE,
        startsAt: iso.replace(/([+-]\d{2}:\d{2})$/, "$1"),
        attrs: [],
        bookingUrl: decode(url),
      });
    }
  });
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed && failed === results.length) throw new Error(`all ${failed} Jerusalem requests failed`);
  return { chain: "cinematheque", venues: [venue], films: [...films.values()], screenings };
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export const CINEMATHEQUE_VENUES: Venue[] = [];

/* ---------------- Haifa (Ethos event portal) ---------------- */
const HAIFA_VENUE = "cinematheque-haifa";

export async function scrapeHaifaCinematheque(): Promise<AdapterResult> {
  const venue = VENUE_BY_ID.get(HAIFA_VENUE)!;
  const html = (await getText("https://www.ethos.co.il/Events/cin/%D7%A7%D7%95%D7%9C%D7%A0%D7%95%D7%A2")).replace(/\s+/g, " ");
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const chunks = html.split('<a href="https://www.ethos.co.il/Event/').slice(1);
  for (const chunk of chunks) {
    const id = /^(\d+)\//.exec(chunk)?.[1];
    const date = /class="event-date">\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s*</.exec(chunk);
    const title = /class="cat-text">\s*([^<]+?)\s*</.exec(chunk)?.[1];
    const time = /class="event-time">[\s\S]*?<span>\s*(\d{1,2}):(\d{2})\s*<\/span>/.exec(chunk);
    const hall = /class="event-location">[\s\S]*?<\/svg>\s*([^<]+?)\s*</.exec(chunk)?.[1];
    const img = /<img src="(https:\/\/www\.ethos\.co\.il\/prdPics\/[^"]+)"/.exec(chunk)?.[1];
    if (!id || !date || !title || !time) continue;
    const year = date[3].length === 2 ? 2000 + Number(date[3]) : Number(date[3]);
    const cleanName = decode(title);
    const filmId = "haifa-" + shortHash(cleanName.toLowerCase());
    if (!films.has(filmId)) films.set(filmId, { chain: "cinematheque", sourceId: filmId, title: cleanName, posterUrl: img });
    screenings.push({
      chain: "cinematheque",
      sourceId: `haifa-${id}-${date[1]}${date[2]}${time[1]}${time[2]}`,
      sourceFilmId: filmId,
      venueId: HAIFA_VENUE,
      startsAt: zonedIso(year, Number(date[2]), Number(date[1]), Number(time[1]), Number(time[2])),
      attrs: [],
      hall: hall ? decode(hall) : undefined,
      bookingUrl: `https://www.ethos.co.il/Event/${id}`,
    });
  }
  return { chain: "cinematheque", venues: [venue], films: [...films.values()], screenings };
}

import { zonedToIso as zonedIso } from "@/lib/tz";

/** Runs every cinematheque parser; a failure in one does not hide the others. */
export async function scrapeCinematheques(): Promise<AdapterResult> {
  const parts = await Promise.allSettled([
    scrapeJerusalemCinematheque(), scrapeHaifaCinematheque(), scrapeTelAvivCinematheque(),
    scrapeHolonCinematheque(), scrapeHerzliyaCinematheque(), scrapeSderotCinematheque(),
  ]);
  for (const p of parts) if (p.status === "rejected") console.warn("  cinematheque source failed:", p.reason instanceof Error ? p.reason.message : p.reason);
  const ok = parts.filter((p): p is PromiseFulfilledResult<AdapterResult> => p.status === "fulfilled").map((p) => p.value);
  if (!ok.length) throw new Error(parts.map((p) => (p.status === "rejected" ? String(p.reason) : "")).join("; "));
  return {
    chain: "cinematheque",
    venues: ok.flatMap((r) => r.venues),
    films: ok.flatMap((r) => r.films),
    screenings: ok.flatMap((r) => r.screenings),
  };
}

/* ---------------- Tel Aviv (WordPress theme ajax: dates -> movies -> times) ---------------- */
const TA_VENUE = "cinematheque-ta";
const TA_AJAX = "https://www.cinema.co.il/wp-content/themes/cinematheque_new_theme/ajax_data.php";
const OPTION_RE = /<option value="([^"]+)"(?:[^>]*data-date="([^"]*)")?(?:[^>]*data-time="([^"]*)")?[^>]*>([^<]*)<\/option>/g;

function options(html: string): { value: string; date?: string; time?: string; label: string }[] {
  return [...html.matchAll(OPTION_RE)].map((m) => ({ value: m[1], date: m[2], time: m[3], label: decode(m[4]).trim() })).filter((o) => o.value && !/^בחר/.test(o.label));
}

export async function scrapeTelAvivCinematheque(days = 8): Promise<AdapterResult> {
  const venue = VENUE_BY_ID.get(TA_VENUE)!;
  const wanted = new Set(Array.from({ length: days }, (_, i) => ymdPlusDays(i)));
  const dates = options(await getText(`${TA_AJAX}?action=get_dates_all&lang=he`)).filter((d) => d.date && wanted.has(d.date));
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const movieJobs: { date: string; value: string; label: string }[] = [];
  await pool(dates, 3, async (d) => {
    const movies = options(await getText(`${TA_AJAX}?action=get_movies&values=${encodeURIComponent(d.value)}&lang=he&tc=1`));
    for (const m of movies) movieJobs.push({ date: d.date!, value: m.value, label: m.label });
  });
  await pool(movieJobs, 4, async (m) => {
    const html = await getText(`${TA_AJAX}?action=get_times&values=${encodeURIComponent(m.value)}&lang=he&tc=2`);
    const times = options(html.split("@")[0]);
    const title = m.label.replace(/\s*\|.*$/, "").trim() || m.label; // "בלייד ראנר | הקרנה+פאנל | מועדון" -> "בלייד ראנר"
    const filmId = "ta-" + shortHash(title.toLowerCase());
    if (!films.has(filmId)) films.set(filmId, { chain: "cinematheque", sourceId: filmId, title, isEvent: /פאנל|הרצאה|מפגש|אירוע|פסטיבל|טקס/.test(m.label) && !/הקרנה/.test(m.label) });
    const [y, mo, dd] = m.date.split("-").map(Number);
    for (const t of times) {
      const hm = /^(\d{1,2}):(\d{2})$/.exec(t.time ?? t.label);
      if (!hm) continue;
      screenings.push({
        chain: "cinematheque",
        sourceId: `ta-${t.value}`,
        sourceFilmId: filmId,
        venueId: TA_VENUE,
        startsAt: zonedIso(y, mo, dd, Number(hm[1]), Number(hm[2])),
        attrs: [],
        bookingUrl: `https://cintlv.pres.global/order/${t.value}`,
      });
    }
  });
  if (dates.length && !screenings.length) throw new Error("Tel Aviv cinematheque: no screenings parsed");
  return { chain: "cinematheque", venues: [venue], films: [...films.values()], screenings };
}

/* ---------------- Holon (WordPress REST: one post per film, showtimes in ACF) ---------------- */
const HOLON_VENUE = "cinematheque-holon";
const HOLON_API = "https://www.cinemaholon.org.il/wp-json/wp/v2/mt_event";

interface HolonDate { ActualEventDate?: string; DirectLink?: string; EventId?: string; SoldOut?: string }
interface HolonPost {
  id: number;
  title?: { rendered?: string };
  link?: string;
  acf?: {
    event_display_dates?: HolonDate[];
    LongMinutes?: string | number;
    MediumImageUrl?: string;
    TrailerUrl?: string;
    BriefText?: string;
    ages?: string;
    cast?: string;
  };
}

export async function scrapeHolonCinematheque(days = 30): Promise<AdapterResult> {
  const venue = VENUE_BY_ID.get(HOLON_VENUE)!;
  const posts = JSON.parse(await getText(`${HOLON_API}?per_page=100&orderby=date&order=desc`)) as HolonPost[];
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const now = Date.now();
  const horizon = now + days * 864e5;

  for (const post of posts) {
    const title = decode(post.title?.rendered ?? "").replace(/\s+/g, " ").trim();
    const dates = post.acf?.event_display_dates ?? [];
    if (!title || !dates.length) continue;
    const filmId = `holon-${post.id}`;
    for (const d of dates) {
      if (!d.ActualEventDate) continue;
      let startsAt: string;
      try { startsAt = localIsoToIso(d.ActualEventDate); } catch { continue; }
      const t = new Date(startsAt).getTime();
      if (!Number.isFinite(t) || t < now - 3600_000 || t > horizon) continue;
      if (!films.has(filmId)) {
        const runtime = Number(post.acf?.LongMinutes);
        films.set(filmId, {
          chain: "cinematheque",
          sourceId: filmId,
          title,
          runtime: Number.isFinite(runtime) && runtime > 0 ? runtime : undefined,
          posterUrl: post.acf?.MediumImageUrl || undefined,
          trailerUrl: post.acf?.TrailerUrl || undefined,
          synopsis: post.acf?.BriefText ? stripHtml(post.acf.BriefText) : undefined,
          ageRating: post.acf?.ages || undefined,
          isEvent: /הרצאה|פאנל|מפגש|טקס|מופע/.test(title) && !/הקרנ/.test(title),
        });
      }
      screenings.push({
        chain: "cinematheque",
        sourceId: `holon-${d.EventId ?? `${post.id}-${startsAt}`}`,
        sourceFilmId: filmId,
        venueId: HOLON_VENUE,
        startsAt,
        attrs: [],
        bookingUrl: d.DirectLink || post.link || "https://www.cinemaholon.org.il",
        soldOut: /true|1|כן/i.test(d.SoldOut ?? ""),
      });
    }
  }
  if (posts.length && !screenings.length) throw new Error("Holon: no upcoming screenings parsed");
  return { chain: "cinematheque", venues: [venue], films: [...films.values()], screenings };
}

const stripHtml = (s: string) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 600);

/* ---------------- Herzliya (WordPress REST: date and time live in the post title) ---------------- */
const HERZ_VENUE = "cinematheque-herzliya";
const HERZ_API = "https://www.hcinema.org.il/wp-json/wp/v2/screenings";
/** "3.10 14:00 | כימים אחדים + הרצאה מפי ענת שרון בלייס" */
const HERZ_TITLE = /^\s*(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{2})\s*\|\s*(.+)$/;

export async function scrapeHerzliyaCinematheque(days = 45): Promise<AdapterResult> {
  const venue = VENUE_BY_ID.get(HERZ_VENUE)!;
  const posts = JSON.parse(await getText(`${HERZ_API}?per_page=100&orderby=date&order=desc`)) as { id: number; title?: { rendered?: string }; link?: string }[];
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const now = new Date();
  const horizon = now.getTime() + days * 864e5;

  for (const post of posts) {
    const m = HERZ_TITLE.exec(decode(post.title?.rendered ?? "").replace(/\s+/g, " "));
    if (!m) continue;
    const day = Number(m[1]), month = Number(m[2]);
    // the title carries no year: pick the one that puts the screening in the coming window
    const year = pickYear(month, day, now);
    let startsAt: string;
    try { startsAt = zonedIso(year, month, day, Number(m[3]), Number(m[4])); } catch { continue; }
    const t = new Date(startsAt).getTime();
    if (!Number.isFinite(t) || t < now.getTime() - 3600_000 || t > horizon) continue;
    const raw = m[5].trim();
    const title = raw.replace(/\s*\+\s*(הרצאה|מפגש|פאנל|שיח).*$/, "").replace(/^(טרום בכורה|בכורה)\s*:\s*/, "").trim();
    if (!title) continue;
    const filmId = `herz-${shortHash(title.toLowerCase())}`;
    if (!films.has(filmId)) films.set(filmId, { chain: "cinematheque", sourceId: filmId, title, isEvent: /ערב זיכרון|טקס|הרצאה בלבד/.test(raw) });
    screenings.push({ chain: "cinematheque", sourceId: `herz-${post.id}`, sourceFilmId: filmId, venueId: HERZ_VENUE, startsAt, attrs: [], bookingUrl: post.link || "https://www.hcinema.org.il" });
  }
  return { chain: "cinematheque", venues: [venue], films: [...films.values()], screenings };
}

/** A day/month with no year: choose the year that lands nearest ahead of today. */
function pickYear(month: number, day: number, now: Date): number {
  const y = now.getFullYear();
  const candidates = [y - 1, y, y + 1];
  let best = y, bestScore = Infinity;
  for (const c of candidates) {
    const diff = Date.UTC(c, month - 1, day, 12) - now.getTime();
    const score = diff < -2 * 864e5 ? Infinity : diff; // already well past: reject
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}

/* ---------------- Sderot (Drupal listing with real UTC <time> elements) ---------------- */
const SDEROT_VENUE = "cinematheque-sderot";
/** <div class="title"><a href="/movie/1471">בחזרה מההימלאיה | Valle de sombras</a></div> */
const SDEROT_TITLE = /<div class="title">\s*<a[^>]*>([^<]{2,160})<\/a>/;
const SDEROT_TIME = /<time[^>]+datetime="(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)"/;
const SDEROT_TICKETS = /<a[^>]+href="(https:\/\/sderot-cin\.smarticket[^"]+)"/;

export async function scrapeSderotCinematheque(days = 30): Promise<AdapterResult> {
  const venue = VENUE_BY_ID.get(SDEROT_VENUE)!;
  const html = await getText("https://www.sderot-cin.org.il/movies");
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const now = Date.now();
  const horizon = now + days * 864e5;

  // one screening per .views-row, and the <time> value is genuinely UTC (16:30Z renders as 19:30)
  for (const row of html.split(/<div class="views-row">/).slice(1)) {
    const time = SDEROT_TIME.exec(row);
    const titleM = SDEROT_TITLE.exec(row);
    if (!time || !titleM) continue;
    const t = Date.parse(time[1]);
    if (!Number.isFinite(t) || t < now - 3600_000 || t > horizon) continue;
    const full = decode(titleM[1]).replace(/\s+/g, " ").trim();
    let title = full.split("|")[0].trim() || full; // "עברית | English" -> Hebrew
    title = title.replace(/\s+[-–—]\s+(לרגל|חוגגים|הקרנה חגיגית|במסגרת)[\sל].*$/u, "").trim();
    if (!title) continue;
    const filmId = `sderot-${shortHash(title.toLowerCase())}`;
    if (!films.has(filmId)) {
      const original = full.includes("|") ? full.split("|").slice(1).join("|").trim() : undefined;
      films.set(filmId, { chain: "cinematheque", sourceId: filmId, title, originalTitle: original && /[A-Za-z]/.test(original) ? original : undefined });
    }
    screenings.push({
      chain: "cinematheque",
      sourceId: `sderot-${shortHash(`${title}${time[1]}`)}`,
      sourceFilmId: filmId,
      venueId: SDEROT_VENUE,
      startsAt: new Date(t).toISOString(),
      attrs: [],
      bookingUrl: decode(SDEROT_TICKETS.exec(row)?.[1] ?? "https://www.sderot-cin.org.il/movies"),
    });
  }
  return { chain: "cinematheque", venues: [venue], films: [...films.values()], screenings };
}
