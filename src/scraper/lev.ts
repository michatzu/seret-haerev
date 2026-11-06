/**
 * Lev Cinemas: the WordPress theme exposes the daily schedule per branch as an HTML fragment.
 * Each <li> is one screening: title, time, a two-step order link (pcode/loc) and a link to the film page.
 *
 * The regular programme is published a week at a time, but a festival, a film club or a premiere
 * goes on sale weeks ahead on a few scattered days. The quick-booking form lists every film a branch
 * has on sale at all, so a branch whose list names a film the week does not show is read further
 * ahead, day by day, until each of those films has turned up.
 */
import type { AdapterResult, Attr, RawFilm, RawScreening } from "@/lib/types";
import { LEV_BRANCHES, VENUES } from "@/data/venues";
import { zonedToIso, ymdPlusDays } from "@/lib/tz";
import { getText, pool } from "./http";

const AJAX = "https://www.lev.co.il/wp-content/themes/lev/ajax_data.php";
const ORDER_RE = /<a\s+href="(https:\/\/www\.lev\.co\.il\/order\/\?pcode=(\d+)&(?:amp;)?loc=(\d+))"[^>]*class="topmenua"[^>]*>\s*([^<]+?)\s*<span>\s*(\d{1,2}):(\d{2})\s*<\/span>/;
const MOVIE_RE = /<a\s+href="https:\/\/www\.lev\.co\.il\/movies\/([^"/]+)\/?"[^>]*class="smovielink"/;
const OPTION_RE = /<option\s+value="\d+"[^>]*>([^<]+)</g;
/** the week every branch is read for, whatever its film list says */
const WEEK = 8;

type Branch = (typeof LEV_BRANCHES)[number];

export async function scrapeLev(days = 45): Promise<AdapterResult> {
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const seen = new Map<string, Set<string>>(LEV_BRANCHES.map((b) => [b.venueId, new Set<string>()]));

  async function readDay({ loc, venueId }: Branch, date: string): Promise<void> {
    const html = (await getText(`${AJAX}?clang=he&action=movie_on_location_new&loc=${encodeURIComponent(loc)}&date=${date}`)).replace(/<!--[\s\S]*?-->/g, "");
    const [y, m, d] = date.split("-").map(Number);
    for (const block of html.split("<li")) {
      const order = ORDER_RE.exec(block);
      if (!order) continue;
      const [, orderUrl, pcode, , rawTitle, hh, mm] = order;
      const slug = MOVIE_RE.exec(block)?.[1];
      const title = decodeEntities(rawTitle).trim();
      seen.get(venueId)?.add(normTitle(title));
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
  }

  const week = Math.min(days, WEEK);
  const jobs = LEV_BRANCHES.flatMap((b) => Array.from({ length: week }, (_, i) => ({ b, date: ymdPlusDays(i) })));
  const results = await pool(jobs, 4, ({ b, date }) => readDay(b, date));
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed && failed === results.length) throw new Error(`all ${failed} Lev requests failed`);

  // Two branches at a time, two days each: the same four requests in flight as the week above.
  await pool(LEV_BRANCHES, 2, async (b) => {
    const pending = await titlesOnSale(b.loc)
      .then((all) => new Set(all.filter((t) => !seen.get(b.venueId)!.has(t))))
      .catch(() => null); // without the list, read the whole horizon
    for (let i = week; i < days && (pending === null || pending.size > 0); i += 2) {
      const dates = [i, i + 1].filter((n) => n < days).map((n) => ymdPlusDays(n));
      await Promise.allSettled(dates.map((date) => readDay(b, date)));
      if (pending) for (const t of seen.get(b.venueId)!) pending.delete(t);
    }
  });

  return { chain: "lev", venues: VENUES.filter((v) => v.chain === "lev"), films: [...films.values()], screenings };
}

/** Every film a branch is selling tickets for, by the title its schedule uses. */
async function titlesOnSale(loc: string): Promise<string[]> {
  const html = (await getText(`${AJAX}?action=get_movies&passval=${encodeURIComponent(loc)}`)).replace(/<!--[\s\S]*?-->/g, "");
  const titles = [...html.matchAll(OPTION_RE)].map((m) => normTitle(decodeEntities(m[1])));
  if (!titles.length) throw new Error(`Lev ${loc}: empty film list`);
  return titles;
}

const normTitle = (s: string) => s.replace(/\s+/g, " ").trim();

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
