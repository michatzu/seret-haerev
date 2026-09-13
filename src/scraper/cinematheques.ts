/** Cinematheques publish plain HTML schedules; each one gets a small parser. */
import type { AdapterResult, RawFilm, RawScreening, Venue } from "@/lib/types";
import { VENUE_BY_ID } from "@/data/venues";
import { ymdPlusDays } from "@/lib/tz";
import { getText, pool } from "./http";
import { shortHash } from "@/lib/text";

/* ---------------- Jerusalem (Drupal calendar, one page per day) ---------------- */
const JLM_VENUE = "cinematheque-jlm";
const JLM_ITEM =
  /<span class="date-display-single"[^>]*content="([^"]+)"[^>]*>[\s\S]*?<button class="toptix-purchase"\s+data-url="([^"]+)"\s+data-event-id="(\d+)"[^>]*data-event-title="([^"]*)"/g;

export async function scrapeJerusalemCinematheque(days = 8): Promise<AdapterResult> {
  const venue = VENUE_BY_ID.get(JLM_VENUE)!;
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const dates = Array.from({ length: days }, (_, i) => ymdPlusDays(i));
  const results = await pool(dates, 3, async (date) => {
    const html = await getText(`https://jer-cin.org.il/he/article/4285?date=${date}`);
    for (const m of html.matchAll(JLM_ITEM)) {
      const [, iso, url, eventId, rawTitle] = m;
      const title = decode(rawTitle).trim();
      if (!title || !iso.startsWith(date)) continue;
      const filmId = "jlm-" + shortHash(title.toLowerCase());
      if (!films.has(filmId)) films.set(filmId, { chain: "cinematheque", sourceId: filmId, title });
      screenings.push({
        chain: "cinematheque",
        sourceId: `jlm-${eventId}`,
        sourceFilmId: filmId,
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
  const parts = await Promise.allSettled([scrapeJerusalemCinematheque(), scrapeHaifaCinematheque(), scrapeTelAvivCinematheque()]);
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
