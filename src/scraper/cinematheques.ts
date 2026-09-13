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
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
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
    if (!id || !date || !title || !time) continue;
    const year = date[3].length === 2 ? 2000 + Number(date[3]) : Number(date[3]);
    const cleanName = decode(title);
    const filmId = "haifa-" + shortHash(cleanName.toLowerCase());
    if (!films.has(filmId)) films.set(filmId, { chain: "cinematheque", sourceId: filmId, title: cleanName });
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
  const parts = await Promise.allSettled([scrapeJerusalemCinematheque(), scrapeHaifaCinematheque()]);
  const ok = parts.filter((p): p is PromiseFulfilledResult<AdapterResult> => p.status === "fulfilled").map((p) => p.value);
  if (!ok.length) throw new Error(parts.map((p) => (p.status === "rejected" ? String(p.reason) : "")).join("; "));
  return {
    chain: "cinematheque",
    venues: ok.flatMap((r) => r.venues),
    films: ok.flatMap((r) => r.films),
    screenings: ok.flatMap((r) => r.screenings),
  };
}
