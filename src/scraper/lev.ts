/**
 * Lev Cinemas: the WordPress theme exposes the daily schedule per branch as an HTML fragment.
 * Each <li> is one screening: title, time, a two-step order link (pcode/loc) and a link to the film page.
 */
import type { AdapterResult, Attr, RawFilm, RawScreening } from "@/lib/types";
import { LEV_BRANCHES, VENUES } from "@/data/venues";
import { zonedToIso, ymdPlusDays } from "@/lib/tz";
import { getText, pool } from "./http";

const ORDER_RE = /<a\s+href="(https:\/\/www\.lev\.co\.il\/order\/\?pcode=(\d+)&(?:amp;)?loc=(\d+))"[^>]*class="topmenua"[^>]*>\s*([^<]+?)\s*<span>\s*(\d{1,2}):(\d{2})\s*<\/span>/;
const MOVIE_RE = /<a\s+href="https:\/\/www\.lev\.co\.il\/movies\/([^"/]+)\/?"[^>]*class="smovielink"/;

export async function scrapeLev(days = 8): Promise<AdapterResult> {
  const jobs: { loc: string; venueId: string; date: string }[] = [];
  for (const b of LEV_BRANCHES) for (let i = 0; i < days; i++) jobs.push({ ...b, date: ymdPlusDays(i) });

  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const results = await pool(jobs, 4, async ({ loc, venueId, date }) => {
    const url = `https://www.lev.co.il/wp-content/themes/lev/ajax_data.php?clang=he&action=movie_on_location_new&loc=${encodeURIComponent(loc)}&date=${date}`;
    const html = (await getText(url)).replace(/<!--[\s\S]*?-->/g, "");
    const [y, m, d] = date.split("-").map(Number);
    for (const block of html.split("<li")) {
      const order = ORDER_RE.exec(block);
      if (!order) continue;
      const [, orderUrl, pcode, , rawTitle, hh, mm] = order;
      const slug = MOVIE_RE.exec(block)?.[1];
      const title = decodeEntities(rawTitle).trim();
      const dubbed = /מדובב/.test(title);
      const cleanTitle = title.replace(/\s*-?\s*מדובב(ת)?\s*$/u, "").trim();
      const filmId = slug ? decodeURIComponent(slug) : cleanTitle;
      if (!films.has(filmId)) films.set(filmId, { chain: "lev", sourceId: filmId, title: cleanTitle, isKids: dubbed });
      const attrs: Attr[] = dubbed ? ["dubbed"] : [];
      screenings.push({
        chain: "lev",
        sourceId: pcode,
        sourceFilmId: filmId,
        venueId,
        startsAt: zonedToIso(y, m, d, Number(hh), Number(mm)),
        attrs,
        dubbedLang: dubbed ? "he" : undefined,
        bookingUrl: orderUrl.replace(/&amp;/g, "&"),
      });
    }
  });
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed && failed === results.length) throw new Error(`all ${failed} Lev requests failed`);

  return { chain: "lev", venues: VENUES.filter((v) => v.chain === "lev"), films: [...films.values()], screenings };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}
