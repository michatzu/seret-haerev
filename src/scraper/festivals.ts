/**
 * Film festivals. A festival is a cinema that exists for nine days: it programmes hundreds of
 * screenings across halls that are not cinemas the rest of the year (a museum, a club, the plaza
 * outside the cinematheque), and it disappears again. Each festival gets a parser and a hall table.
 *
 * Haifa is the one running now. Its site publishes the whole schedule on a single page, so the
 * festival costs exactly one request.
 */
import type { AdapterResult, RawFilm, RawScreening, Venue } from "@/lib/types";
import { getText } from "./http";
import { zonedToIso } from "@/lib/tz";
import { shortHash } from "@/lib/text";
import { looksLikeEvent } from "./modulus";

const CHAIN = "other" as const;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/* ----------------------------------------------- Haifa International Film Festival */

const HAIFA_URL = "https://www.haifaff.co.il/%D7%9C%D7%95%D7%97_%D7%94%D7%A7%D7%A8%D7%A0%D7%95%D7%AA"; // /לוח_הקרנות
const HAIFA_FESTIVAL = "פסטיבל חיפה";

/**
 * The festival halls, keyed by the site's own theatre id. Coordinates are hand-checked; the ones
 * inside the Auditorium/Cinematheque complex on Sderot HaNasi sit within a couple of hundred metres
 * of each other, which is well inside the precision this site sorts by.
 */
const HAIFA_HALLS: Record<string, { name: string; lat: number; lng: number; kind: Venue["kind"]; address?: string; id?: string }> = {
  "31": { name: "רפפורט", lat: 32.80355, lng: 34.9847, kind: "boutique", address: "שדרות הנשיא 138, חיפה" },
  "32": { name: "אודיטוריום חיפה", lat: 32.803491, lng: 34.985062, kind: "boutique", address: "שדרות הנשיא 142, חיפה" },
  // the festival's main hall is the cinematheque we already list, so it keeps that venue id
  "33": { id: "cinematheque-haifa", name: "סינמטק חיפה", lat: 32.8073, lng: 34.9866, kind: "cinematheque", address: "שדרות הנשיא 142, חיפה" },
  // the museum runs a cinema all year under its own ticketing; the festival borrows the same hall
  "34": { id: "sm-tikotin", name: "קולנוע טיקוטין", lat: 32.809349, lng: 34.985385, kind: "boutique", address: "שדרות הנשיא 89, חיפה" },
  "35": { name: "קריגר (כרמל צרפתי)", lat: 32.820231, lng: 34.972153, kind: "boutique", address: "אליהו חכים, חיפה" },
  "5313": { name: "רחבת הסינמטק", lat: 32.8073, lng: 34.9866, kind: "outdoor", address: "שדרות הנשיא 142, חיפה" },
  "13310": { name: "מועדון הביט", lat: 32.8073, lng: 34.9866, kind: "boutique", address: "מתחם האודיטוריום, חיפה" },
};

const DAY_SECTION = /id="(\d{2})(\d{2})"/g;
const HALL_BLOCK = /data-theater="(\d+)"/g;
const SCREENING = /<div class="hour">\s*(\d{1,2}):(\d{2})\s*<\/div>\s*<h3>([\s\S]*?)<\/h3>(?:\s*<div class="info">([\s\S]*?)<\/div>)?([\s\S]{0,700}?)(?=<div class="screeningDetailes"|<\/div>\s*<\/div>\s*<\/div>|$)/g;
const MORE_LINK = /href="([^"]*?\/(?:%D7%A1%D7%A8%D7%98%D7%99%D7%9D|סרטים)\/\d+[^"]*)"/;
const ORDER_LINK = /href="([^"]*?(?:%D7%A1%D7%9C_%D7%94%D7%A7%D7%A0%D7%99%D7%95%D7%AA|סל_הקניות)\/\d+[^"]*)"/;

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
const text = (s: string) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/** "102 דק', יוונית, תרגום לעברית, אנגלית" -> runtime and spoken language. */
function parseInfo(info: string): { runtime?: number; language?: string } {
  const t = text(info);
  const mins = /(\d{2,3})\s*דק/.exec(t);
  const lang = /(?:^|,)\s*([֐-׿]{3,12}ית)\s*(?:,|$)/.exec(t);
  return { runtime: mins ? Number(mins[1]) : undefined, language: lang?.[1] };
}

/** The festival year is implicit: the schedule only ever covers the coming edition. */
function festivalYear(month: number, now: Date): number {
  const y = now.getFullYear();
  // a September/October schedule read in January belongs to this year; read in December, to the next
  return month >= now.getMonth() + 1 - 1 ? y : y + 1;
}

export async function scrapeHaifaFestival(): Promise<AdapterResult> {
  const html = await getText(HAIFA_URL, { headers: { "user-agent": UA } }, 45_000);
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const venues = new Map<string, Venue>();
  const now = new Date();
  const horizon = now.getTime() + 120 * 864e5;

  // the page is nine day sections, each a row of hall columns
  const marks = [...html.matchAll(DAY_SECTION)];
  for (let i = 0; i < marks.length; i++) {
    const day = Number(marks[i][1]);
    const month = Number(marks[i][2]);
    const section = html.slice(marks[i].index! + marks[i][0].length, marks[i + 1]?.index ?? html.length);
    const year = festivalYear(month, now);

    const hallMarks = [...section.matchAll(HALL_BLOCK)];
    for (let h = 0; h < hallMarks.length; h++) {
      const hall = HAIFA_HALLS[hallMarks[h][1]];
      if (!hall) continue;
      const block = section.slice(hallMarks[h].index!, hallMarks[h + 1]?.index ?? section.length);
      const venueId = hall.id ?? `fest-haifa-${hallMarks[h][1]}`;
      SCREENING.lastIndex = 0;
      for (const s of block.matchAll(SCREENING)) {
        const h3 = s[3];
        const title = text(h3.replace(/<span>[\s\S]*?<\/span>/g, " "));
        const director = text(/<span>([\s\S]*?)<\/span>/.exec(h3)?.[1] ?? "");
        if (!title) continue;
        let startsAt: string;
        try { startsAt = zonedToIso(year, month, day, Number(s[1]), Number(s[2])); } catch { continue; }
        const t = Date.parse(startsAt);
        if (!Number.isFinite(t) || t < now.getTime() - 6 * 3600_000 || t > horizon) continue;

        venues.set(venueId, { id: venueId, chain: venueId.startsWith("cinematheque-") ? "cinematheque" : CHAIN, name: hall.name, city: "חיפה", address: hall.address, lat: hall.lat, lng: hall.lng, kind: hall.kind, url: "https://www.haifaff.co.il" });
        const { runtime, language } = parseInfo(s[4] ?? "");
        const tail = s[5] ?? "";
        const order = ORDER_LINK.exec(tail)?.[1];
        const more = MORE_LINK.exec(tail)?.[1];
        // the festival's own film-page id, so the poster fetcher can find the page later
        const pageId = more ? /\/(?:%D7%A1%D7%A8%D7%98%D7%99%D7%9D|\u05e1\u05e8\u05d8\u05d9\u05dd)\/(\d+)/.exec(decode(more))?.[1] : undefined;
        // the festival's own film id when it published one, so its page (and poster) can be found
        const filmId = pageId ? `haifa-film-${pageId}` : `fest-haifa-${shortHash(title.toLowerCase())}`;
        if (!films.has(filmId)) {
          films.set(filmId, { chain: CHAIN, sourceId: filmId, title, runtime, language, director: director || undefined, isEvent: looksLikeEvent(title) });
        }
        screenings.push({
          chain: CHAIN,
          sourceId: `fest-haifa-${shortHash(`${filmId}${startsAt}${venueId}`)}`,
          sourceFilmId: filmId,
          venueId,
          startsAt,
          attrs: hall.kind === "outdoor" ? ["outdoor"] : [],
          hall: HAIFA_FESTIVAL,
          bookingUrl: decode(order ?? more ?? HAIFA_URL),
        });
      }
    }
  }
  if (marks.length && !screenings.length) throw new Error("Haifa festival: schedule found but nothing parsed");
  return { chain: CHAIN, venues: [...venues.values()], films: [...films.values()], screenings };
}

/* ------------------------------------------------------------------ entry */

export async function scrapeFestivals(): Promise<AdapterResult> {
  const parts = await Promise.allSettled([scrapeHaifaFestival(), scrapeJerusalemTheatre()]);
  for (const p of parts) if (p.status === "rejected") console.warn("  festival source failed:", p.reason instanceof Error ? p.reason.message : p.reason);
  const ok = parts.filter((p): p is PromiseFulfilledResult<AdapterResult> => p.status === "fulfilled").map((p) => p.value);
  return {
    chain: CHAIN,
    venues: ok.flatMap((r) => r.venues),
    films: ok.flatMap((r) => r.films),
    screenings: ok.flatMap((r) => r.screenings),
  };
}

/* ----------------------------------------------- Jerusalem Theatre (a theatre that screens films) */

const JT_BOARD = "https://www.jerusalem-theatre.co.il/na_ajax.php?action=getBoard";
const JT_VENUE: Venue = {
  id: "jerusalem-theatre", chain: CHAIN, name: "תיאטרון ירושלים", city: "ירושלים",
  address: "דוד מרכוס 20", lat: 31.768918, lng: 35.215517, kind: "boutique", url: "https://www.jerusalem-theatre.co.il",
};

interface JtDate { date?: number; hall?: string; ticket?: string; status?: string; remark?: string }
interface JtItem {
  id?: string;
  title?: string;
  length?: string;
  img?: string;
  link?: string;
  "parent-group"?: string;
  dates?: JtDate[];
}

export async function scrapeJerusalemTheatre(days = 45): Promise<AdapterResult> {
  // items is an object keyed by id, not an array
  const board = JSON.parse(await getText(JT_BOARD, { headers: { "user-agent": UA } }, 30_000)) as { items?: Record<string, JtItem> | JtItem[] };
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const now = Date.now();
  const horizon = now + days * 864e5;

  const items = Array.isArray(board.items) ? board.items : Object.values(board.items ?? {});
  for (const item of items) {
    if (item["parent-group"] !== "eventGrp_cinema") continue;
    const title = (item.title ?? "").replace(/\s+/g, " ").trim();
    if (!title || !item.dates?.length) continue;
    const filmId = `jt-${item.id ?? shortHash(title)}`;
    const minutes = Number(/(\d{2,3})\s*דקות/.exec(item.length ?? "")?.[1]);

    for (const d of item.dates) {
      if (!d.date || d.status === "cancelled") continue;
      // the board's number looks like a unix timestamp but carries Israel wall-clock time: the
      // theatre's own page shows 18:00 where a true epoch would read 21:00
      const wall = new Date(d.date * 1000);
      const startsAt = zonedToIso(wall.getUTCFullYear(), wall.getUTCMonth() + 1, wall.getUTCDate(), wall.getUTCHours(), wall.getUTCMinutes());
      const at = Date.parse(startsAt);
      if (!Number.isFinite(at) || at < now - 3600_000 || at > horizon) continue;
      if (!films.has(filmId)) {
        films.set(filmId, {
          chain: CHAIN,
          sourceId: filmId,
          title,
          runtime: Number.isFinite(minutes) && minutes > 30 ? minutes : undefined,
          posterUrl: item.img || undefined,
          isEvent: looksLikeEvent(title),
        });
      }
      screenings.push({
        chain: CHAIN,
        sourceId: `jt-${d.ticket ?? `${filmId}-${d.date}`}`,
        sourceFilmId: filmId,
        venueId: JT_VENUE.id,
        startsAt,
        attrs: [],
        hall: d.hall ? `אולם ${d.hall}` : undefined,
        // the box office runs on a host that does not resolve publicly, so the film's own page it is
        bookingUrl: item.link ? decode(item.link) : "https://www.jerusalem-theatre.co.il",
      });
    }
  }
  return { chain: CHAIN, venues: screenings.length ? [JT_VENUE] : [], films: [...films.values()], screenings };
}
