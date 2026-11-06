/** Cinematheques publish plain HTML schedules; each one gets a small parser. */
import type { AdapterResult, RawFilm, RawScreening, Venue } from "@/lib/types";
import { VENUE_BY_ID } from "@/data/venues";
import { localIsoToIso, ymdPlusDays, zonedToIso as zonedIso } from "@/lib/tz";
import { getText, pool } from "./http";
import { shortHash } from "@/lib/text";
import { looksLikeEvent } from "./modulus";

/**
 * How far ahead to keep what a cinematheque publishes.
 *
 * They print a month's programme at a time, and some list next season's courses and operas months
 * early. The site's longest view is a month, so anything short of everything they have published
 * leaves holes in it; a third of a year keeps all of that and still stops a listing that runs away.
 */
const HORIZON_DAYS = 120;

/* ---------------- Jerusalem (Drupal calendar view, one request per day) ---------------- */
const JLM_VENUE = "cinematheque-jlm";
/** It can only be asked a day at a time: two months is this month and all of the next one. */
const JLM_DAYS = 62;
/** The view the page's own day pager reloads; the same rows as the page, at a tenth of the size. */
const JLM_VIEW = "https://jer-cin.org.il/he/views/ajax?view_name=custom_calendar_floating_pane&view_display_id=block_1&view_args=";
const JLM_PAGE = "https://jer-cin.org.il/he/article/4285?date=";

/** One day's rows of the calendar view, from its ajax endpoint or, failing that, the page. */
async function jlmDay(date: string): Promise<string> {
  try {
    const cmds = JSON.parse(await getText(JLM_VIEW + date, { headers: { accept: "application/json, text/javascript, */*; q=0.01", "x-requested-with": "XMLHttpRequest" } })) as { data?: unknown }[];
    const html = cmds.map((c) => (typeof c.data === "string" ? c.data : "")).join("");
    if (html.includes("view-custom-calendar-floating-pane")) return html;
  } catch {
    /* fall back to the page itself */
  }
  const page = await getText(JLM_PAGE + date);
  // the page also carries today's full calendar and carousels; the day's rows sit between these two
  const start = page.indexOf("view-custom-calendar-floating-pane");
  const end = page.indexOf("link-main-calendar", start);
  return start < 0 ? "" : page.slice(start, end < 0 ? undefined : end);
}

/**
 * The row's link names what is shown; the ticket button often names the occasion instead, the
 * lecture's title or the course's ("אגדות, פאשיזם והתנגדות..." for "המבוך של פאן + הרצאה").
 */
function jlmTitle(link: string): string {
  return link
    .replace(/^\s*\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\s+/, "") // "10:00-14:00 יריד אומנים..."
    .replace(/\s*\|\s*הקרנות קבועות\s*$/, "") // the regular run, not part of the name
    .replace(/\s+/g, " ")
    .trim();
}
/** Course sessions, concert-lectures and the family-day fair share the calendar with the films. */
const JLM_EVENT = /^(קורס|קונצ'רטו|קונצרטו)\s*:|יריד|דיסקו/;

export async function scrapeJerusalemCinematheque(days = JLM_DAYS): Promise<AdapterResult> {
  const venue = VENUE_BY_ID.get(JLM_VENUE)!;
  const films = new Map<string, RawFilm>();
  const titleToFilm = new Map<string, string>(); // the same film screens on several nodes
  const screenings: RawScreening[] = [];
  const dates = Array.from({ length: days }, (_, i) => ymdPlusDays(i));
  const results = await pool(dates, 3, async (date) => {
    const html = await jlmDay(date);
    // one row per screening: its time, a ticket button when tickets are sold here, and a link to the event
    for (const row of html.split('<div class="item">').slice(1)) {
      const iso = /class="date-display-single"[^>]*content="([^"]+)"/.exec(row)?.[1];
      const nodeId = /<a href="\/he\/event\/(\d+)"/.exec(row)?.[1] ?? /calendar\.(\d+)\./.exec(row)?.[1];
      if (!iso || !nodeId || !iso.startsWith(date)) continue;
      const button = /<button class="toptix-purchase"\s+data-url="([^"]+)"\s+data-event-id="(\d+)"[^>]*?data-event-title="([^"]*)"/.exec(row);
      const link = /<a href="\/he\/event\/\d+">([^<]*)<\/a>/.exec(row)?.[1];
      const title = jlmTitle(decode(link ?? button?.[3] ?? ""));
      if (!title) continue;
      // the node id is the film's own page, which is where its poster lives
      const key = title.toLowerCase();
      const id = titleToFilm.get(key) ?? `jlm-node-${nodeId}`;
      if (!titleToFilm.has(key)) titleToFilm.set(key, id);
      if (!films.has(id)) films.set(id, { chain: "cinematheque", sourceId: id, title, isEvent: JLM_EVENT.test(title) || looksLikeEvent(title) });
      screenings.push({
        chain: "cinematheque",
        sourceId: button ? `jlm-${button[2]}` : `jlm-node-${nodeId}-${iso.slice(0, 16)}`,
        sourceFilmId: id,
        venueId: JLM_VENUE,
        startsAt: iso,
        attrs: [],
        bookingUrl: button ? decode(button[1]) : `https://jer-cin.org.il/he/event/${nodeId}`,
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

/* ---------------- Haifa (Ethos event listing, sixteen at a time) ---------------- */
const HAIFA_VENUE = "cinematheque-haifa";
/**
 * The monthly programme page loads its events sixteen at a time as you scroll, by asking for the
 * next batch with the ones already on screen listed; the first batch alone is a week.
 */
const HAIFA_EVENTS = "https://www.haifacin.co.il/includes/events.php";
const HAIFA_MAX_PAGES = 15;

export async function scrapeHaifaCinematheque(): Promise<AdapterResult> {
  const venue = VENUE_BY_ID.get(HAIFA_VENUE)!;
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const [ty, tm, td] = ymdPlusDays(0).split("-");
  const horizon = Date.now() + HORIZON_DAYS * 864e5;
  const shown: string[] = [];
  for (let page = 0; page < HAIFA_MAX_PAGES; page++) {
    const url = `${HAIFA_EVENTS}?ajax=1&lang=heb&date=${td}.${tm}.${ty}&category=trom&start=${page}&limit=7&shownEvents=${shown.join(",")}`;
    const html = (await getText(url, { headers: { "x-requested-with": "XMLHttpRequest" } })).replace(/\s+/g, " ");
    let fresh = 0;
    for (const block of html.split(/<div class=['"]portfolio [^'"]*eventContX['"]/).slice(1)) {
      const id = /data-id=['"](\d+)['"]/.exec(block)?.[1];
      if (!id || shown.includes(id)) continue;
      shown.push(id);
      fresh++;
      const title = /class=['"]portfolio-title['"]>\s*([^<]+?)\s*</.exec(block)?.[1];
      // "6.11.26 17:15 , סרט ברפפורט": date, time and hall (Rappaport is next door, at HaNassi 140)
      const when = /class=['"]portfolio-details['"]>\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+(\d{1,2}):(\d{2})\s*,?\s*([^<]*?)\s*</.exec(block);
      const img = /<img src=['"](https:\/\/www\.ethos\.co\.il\/prdPics\/[^'"]+)['"]/.exec(block)?.[1];
      if (!title || !when) continue;
      const [, d, mo, yy, hh, mm, hall] = when;
      const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
      const startsAt = zonedIso(year, Number(mo), Number(d), Number(hh), Number(mm));
      if (new Date(startsAt).getTime() > horizon) continue;
      const cleanName = decode(title);
      const filmId = "haifa-" + shortHash(cleanName.toLowerCase());
      // "רוקולנוע" is the house's rock-history lecture with clips; the rest of the programme is films
      if (!films.has(filmId)) films.set(filmId, { chain: "cinematheque", sourceId: filmId, title: cleanName, posterUrl: img, isEvent: /רוקולנוע/.test(cleanName) });
      screenings.push({
        chain: "cinematheque",
        sourceId: `haifa-${id}-${d}${mo}${hh}${mm}`,
        sourceFilmId: filmId,
        venueId: HAIFA_VENUE,
        startsAt,
        attrs: [],
        hall: hall ? decode(hall) : undefined,
        bookingUrl: `https://www.haifacin.co.il/Event/${id}`,
      });
    }
    if (!fresh) break; // an empty batch is the end of the programme
  }
  if (shown.length && !screenings.length) throw new Error("Haifa cinematheque: no screenings parsed");
  return { chain: "cinematheque", venues: [venue], films: [...films.values()], screenings };
}

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

/* ---------------- Tel Aviv (WordPress theme ajax: the dates, then each day's calendar) ---------------- */
const TA_VENUE = "cinematheque-ta";
const TA_AJAX = "https://www.cinema.co.il/wp-content/themes/cinematheque_new_theme/ajax_data.php";
const OPTION_RE = /<option value="([^"]+)"(?:[^>]*data-date="([^"]*)")?(?:[^>]*data-time="([^"]*)")?[^>]*>([^<]*)<\/option>/g;

function options(html: string): { value: string; date?: string; time?: string; label: string }[] {
  return [...html.matchAll(OPTION_RE)].map((m) => ({ value: m[1], date: m[2], time: m[3], label: decode(m[4]).trim() })).filter((o) => o.value && !/^בחר/.test(o.label));
}

/** What follows a "|" when it describes the screening rather than names anything. */
const TA_LABEL = /^(הקרנ|טרום בכורה|בכורה|מועדון|מפגש|פאנל|הרצאה|שיחה|דיון|\d+\s*שנה|מדובב|כתוביות|ללא תשלום|בליווי|vod)/i;

/**
 * "בלייד ראנר | הקרנה+פאנל | מועדון" is the film and what the screening adds, so the film is the
 * first part. But "אפטר בסינמטק | סנאץ'" and "אפטר בסינמטק | באטמן" are a series and its films,
 * and cutting at the "|" made them one film called "אפטר בסינמטק". A first part that comes with
 * several different second parts is a series, and keeps the second part beside it.
 */
function taTitles(labels: string[]): Map<string, string> {
  const split = (label: string) => {
    const [first = "", ...rest] = label.split("|").map((p) => p.trim()).filter(Boolean);
    return { first: first.replace(/\s+הקרנות קבועות$/, ""), second: rest.find((p) => !TA_LABEL.test(p)) };
  };
  const seconds = new Map<string, Set<string>>();
  for (const label of labels) {
    const { first, second } = split(label);
    if (second) seconds.set(first, (seconds.get(first) ?? new Set()).add(second));
  }
  const out = new Map<string, string>();
  for (const label of labels) {
    const { first, second } = split(label);
    out.set(label, (second && (seconds.get(first)?.size ?? 0) > 1 ? `${first} | ${second}` : first) || label);
  }
  return out;
}

export async function scrapeTelAvivCinematheque(days = HORIZON_DAYS): Promise<AdapterResult> {
  const venue = VENUE_BY_ID.get(TA_VENUE)!;
  const last = ymdPlusDays(days);
  // every date that has a screening: a month of days, then the odd course meeting months ahead
  const dates = [...new Set(options(await getText(`${TA_AJAX}?action=get_dates_all&lang=he`)).map((d) => d.date ?? ""))].filter((d) => d && d >= ymdPlusDays(0) && d <= last);
  // the calendar answers for a whole day at once: titles, times and order links
  const rows: { date: string; label: string; page: string; time: string; order?: string }[] = [];
  const results = await pool(dates, 3, async (date) => {
    const html = (await getText(`${TA_AJAX}?action=get_cal_data1&ids=&date=${date}&lang=he`)).split("@")[0];
    for (const entry of html.split('<div class="calentry">').slice(1)) {
      const link = /<span class="s1"><a href=['"]([^'"]+)['"]>([^<]*)<\/a>/.exec(entry);
      const label = link ? decode(link[2]).replace(/\s+/g, " ").trim() : "";
      if (!link || !label) continue;
      for (const li of entry.match(/<li>[\s\S]*?<\/li>/g) ?? []) {
        const hm = />\s*(\d{1,2}):(\d{2})\s*</.exec(li);
        if (hm) rows.push({ date, label, page: decode(link[1]), time: `${hm[1]}:${hm[2]}`, order: /pres\.global\/order\/(\d+)/.exec(li)?.[1] });
      }
    }
  });
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed && failed === results.length) throw new Error(`all ${failed} Tel Aviv calendar requests failed`);

  const titles = taTitles([...new Set(rows.map((r) => r.label))]);
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  for (const r of rows) {
    const title = titles.get(r.label)!;
    const filmId = "ta-" + shortHash(title.toLowerCase());
    if (!films.has(filmId)) films.set(filmId, { chain: "cinematheque", sourceId: filmId, title, isEvent: /פאנל|הרצאה|מפגש|אירוע|פסטיבל|טקס/.test(r.label) && !/הקרנה/.test(r.label) });
    const [y, mo, dd] = r.date.split("-").map(Number);
    const [hh, mm] = r.time.split(":").map(Number);
    screenings.push({
      chain: "cinematheque",
      sourceId: r.order ? `ta-${r.order}` : `ta-${shortHash(`${title}${r.date}${r.time}`)}`,
      sourceFilmId: filmId,
      venueId: TA_VENUE,
      startsAt: zonedIso(y, mo, dd, hh, mm),
      attrs: [],
      bookingUrl: r.order ? `https://cintlv.pres.global/order/${r.order}` : r.page,
    });
  }
  if (dates.length && !screenings.length) throw new Error("Tel Aviv cinematheque: no screenings parsed");
  return { chain: "cinematheque", venues: [venue], films: [...films.values()], screenings };
}

/* ---------------- Holon (WordPress REST: one post per film, showtimes in ACF) ---------------- */
const HOLON_VENUE = "cinematheque-holon";
const HOLON_API = "https://www.cinemaholon.org.il/wp-json/wp/v2/mt_event";
/** Only what is read below: the full posts are 2.6MB a page, these are 70KB. */
const HOLON_FIELDS = "id,title,link,acf.event_display_dates,acf.LongMinutes,acf.MediumImageUrl,acf.TrailerUrl,acf.BriefText,acf.ages";
const HOLON_MAX_PAGES = 6;

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

export async function scrapeHolonCinematheque(days = HORIZON_DAYS): Promise<AdapterResult> {
  const venue = VENUE_BY_ID.get(HOLON_VENUE)!;
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const seen = new Set<string>();
  const now = Date.now();
  const horizon = now + days * 864e5;
  let posts = 0;

  // There are hundreds of posts, one per film ever shown. A film that gets new dates gets edited,
  // so newest-edited first puts every one with dates ahead on the first page or two; the publish
  // date does not, and a film posted in the spring and brought back this month was missed.
  for (let page = 1; page <= HOLON_MAX_PAGES; page++) {
    let batch: HolonPost[];
    try {
      batch = JSON.parse(await getText(`${HOLON_API}?per_page=100&orderby=modified&order=desc&page=${page}&_fields=${HOLON_FIELDS}`)) as HolonPost[];
    } catch (e) {
      if (page === 1) throw e;
      break; // past the last page WordPress answers 400
    }
    posts += batch.length;
    const before = screenings.length;
    for (const post of batch) {
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
        const sourceId = `holon-${d.EventId ?? `${post.id}-${startsAt}`}`;
        if (seen.has(sourceId)) continue; // a post edited mid-walk can turn up on two pages
        seen.add(sourceId);
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
          sourceId,
          sourceFilmId: filmId,
          venueId: HOLON_VENUE,
          startsAt,
          attrs: [],
          bookingUrl: d.DirectLink || post.link || "https://www.cinemaholon.org.il",
          soldOut: /true|1|כן/i.test(d.SoldOut ?? ""),
        });
      }
    }
    if (batch.length < 100 || screenings.length === before) break;
  }
  if (posts && !screenings.length) throw new Error("Holon: no upcoming screenings parsed");
  return { chain: "cinematheque", venues: [venue], films: [...films.values()], screenings };
}

const stripHtml = (s: string) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 600);

/* ---------------- Herzliya (WordPress REST for the screenings, the home page for their dates) ---------------- */
const HERZ_VENUE = "cinematheque-herzliya";
const HERZ_API = "https://www.hcinema.org.il/wp-json/wp/v2/screenings";
const HERZ_HOME = "https://www.hcinema.org.il/";
const HERZ_MAX_PAGES = 5;
/** "3.10 14:00 | כימים אחדים + הרצאה מפי ענת שרון בלייס" */
const HERZ_TITLE = /^\s*(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{2})\s*\|\s*(.+)$/;

/**
 * The date in a screening's title is typed by hand and can be wrong ("6.10 21:30" for a screening
 * on 6.11); the home page lists every screening by post id with the date from its own field.
 */
async function herzliyaDates(): Promise<Map<string, [number, number, number, number, number]>> {
  const out = new Map<string, [number, number, number, number, number]>();
  try {
    const html = await getText(HERZ_HOME);
    const items = html.split(/<div class="jet-listing-grid__item[^"]*" data-post-id="(\d+)"/);
    for (let i = 1; i + 1 < items.length; i += 2) {
      const m = /__content"\s*>\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*</.exec(items[i + 1]);
      if (m && !out.has(items[i])) out.set(items[i], [+m[3], +m[2], +m[1], +m[4], +m[5]]);
    }
  } catch {
    /* the titles' own dates will do */
  }
  return out;
}

export async function scrapeHerzliyaCinematheque(days = HORIZON_DAYS): Promise<AdapterResult> {
  const venue = VENUE_BY_ID.get(HERZ_VENUE)!;
  const datesById = herzliyaDates();
  const posts: { id: number; title?: { rendered?: string }; link?: string }[] = [];
  for (let page = 1; page <= HERZ_MAX_PAGES; page++) {
    let batch: typeof posts;
    try {
      batch = JSON.parse(await getText(`${HERZ_API}?per_page=100&orderby=date&order=desc&page=${page}&_fields=id,title,link`)) as typeof posts;
    } catch (e) {
      if (page === 1) throw e;
      break; // past the last page WordPress answers 400
    }
    posts.push(...batch);
    if (batch.length < 100) break;
  }
  const listed = await datesById;
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const now = new Date();
  const horizon = now.getTime() + days * 864e5;

  for (const post of posts) {
    const full = decode(post.title?.rendered ?? "").replace(/\s+/g, " ").trim();
    const m = HERZ_TITLE.exec(full);
    const when = listed.get(String(post.id));
    let startsAt: string;
    try {
      if (when) startsAt = zonedIso(...when);
      else if (m) {
        const day = Number(m[1]), month = Number(m[2]);
        // the title carries no year: pick the one that puts the screening in the coming window
        startsAt = zonedIso(pickYear(month, day, now), month, day, Number(m[3]), Number(m[4]));
      } else continue;
    } catch { continue; }
    const t = new Date(startsAt).getTime();
    if (!Number.isFinite(t) || t < now.getTime() - 3600_000 || t > horizon) continue;
    const raw = (m ? m[5] : full).trim();
    const title = raw.replace(/\s*\+\s*(הרצאה|מפגש|פאנל|שיח).*$/, "").replace(/^(טרום בכורה|בכורה)\s*:\s*/, "").trim();
    if (!title) continue;
    const filmId = `herz-${shortHash(title.toLowerCase())}`;
    if (!films.has(filmId)) films.set(filmId, { chain: "cinematheque", sourceId: filmId, title, isEvent: /ערב זיכרון/.test(raw) || looksLikeEvent(raw) });
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

export async function scrapeSderotCinematheque(days = HORIZON_DAYS): Promise<AdapterResult> {
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
    // the row links to the film's own page, which is the only place its still lives
    const movieId = /href="\/movie\/(\d+)"/.exec(row)?.[1];
    const filmId = movieId ? `sderot-movie-${movieId}` : `sderot-${shortHash(title.toLowerCase())}`;
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
