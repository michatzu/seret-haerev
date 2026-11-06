/**
 * Jaffa Cinema (קולנוע יפו): a bar with two small halls on Marzouk ve-Azar Street, selling its own
 * tickets and listed by no chain, no ticketing platform and no events feed.
 *
 * Its home page is the programme. Each film is one card carrying the director, the running time,
 * a "country | year | language | subtitles" line and a link per screening, and the link's slug
 * spells out the date and time ("07-11-2026-2000-ספרות-זולה"), so one request is the whole week.
 * The WordPress API holds the same screenings but not the films they belong to.
 */
import type { AdapterResult, RawFilm, RawScreening, Venue } from "@/lib/types";
import { getText } from "./http";
import { zonedToIso } from "@/lib/tz";

const CHAIN = "other" as const;
const HOST = "https://www.jaffacinema.com";

export const JAFFA_CINEMA: Venue = {
  id: "jaffa-cinema",
  chain: CHAIN,
  name: "קולנוע יפו",
  city: "תל אביב",
  address: "מרזוק ועזר 14, יפו",
  lat: 32.0549,
  lng: 34.75865,
  kind: "boutique",
  url: HOST,
};

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const text = (html: string) => decode(html.replace(/<[^>]*>/g, " "));

/** The first language the card names, as the code the rest of the site uses. */
const LANGUAGES: Record<string, string> = {
  עברית: "he", אנגלית: "en", צרפתית: "fr", ספרדית: "es", איטלקית: "it", גרמנית: "de", יפנית: "ja",
  קוריאנית: "ko", פולנית: "pl", נורווגית: "no", שוודית: "sv", דנית: "da", פורטוגזית: "pt", רוסית: "ru",
  ערבית: "ar", מנדרינית: "zh", קנטונזית: "cn", טורקית: "tr", פרסית: "fa", הונגרית: "hu", יוונית: "el",
};

/** "1 ש' 59 דק'" -> 119 */
function minutes(s: string): number | undefined {
  const m = /(\d+)\s*ש[׳']\s*(\d+)\s*דק/.exec(s);
  const n = m ? +m[1] * 60 + +m[2] : NaN;
  return n > 30 ? n : undefined;
}

export async function scrapeJaffaCinema(): Promise<AdapterResult> {
  const html = await getText(`${HOST}/`);
  const cards = html.split(/<article class="jaffa-movie-card[\s"]/).slice(1);
  if (!cards.length) throw new Error("jaffa cinema: no film cards on the home page");

  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const now = Date.now();

  for (const card of cards) {
    const id = /data-movie-id="(\d+)"/.exec(card)?.[1];
    const title = text(/jaffa-movie-card__title[^>]*>([\s\S]*?)<\/h2>/.exec(card)?.[1] ?? "");
    if (!id || !title) continue;

    const meta = new Map<string, string>();
    for (const m of card.matchAll(/__meta-label">([^<]+)<\/span>\s*<span>([\s\S]*?)<\/span>/g)) meta.set(text(m[1]).replace(/:$/, ""), text(m[2]));
    const desc = /jaffa-movie-card__desc-inner">([\s\S]*?)<\/div>/.exec(card)?.[1] ?? "";
    // "ארה״ב | 1994 | אנגלית | כ.עברית", then the synopsis
    const facts = text(/<strong>([\s\S]*?)<\/strong>/.exec(desc)?.[1] ?? "").split("|").map((s) => s.trim());
    const synopsis = text(desc.replace(/<p>\s*<strong>[\s\S]*?<\/strong>\s*<\/p>/, ""));
    const year = Number(facts.find((f) => /^\d{4}$/.test(f)));
    const language = facts.map((f) => LANGUAGES[f.split(",")[0].trim()]).find(Boolean);
    const subbed = facts.some((f) => /כ\.?\s*עברית|כתוביות/.test(f));
    const trailer = /jaffa-movie-card__trailer"\s+href="([^"]+)"/.exec(card)?.[1];

    const filmId = `jaffa-${id}`;
    let found = 0;
    for (const m of card.matchAll(/jaffa-movie-card__screening"\s+href="([^"]+)"/g)) {
      const slug = decodeURIComponent(m[1].split("/calendar/")[1] ?? "");
      const d = /^(\d{2})-(\d{2})-(\d{4})-(\d{2})(\d{2})/.exec(slug);
      if (!d) continue;
      const startsAt = zonedToIso(+d[3], +d[2], +d[1], +d[4], +d[5]);
      if (Date.parse(startsAt) < now - 3600_000) continue;
      found++;
      screenings.push({
        chain: CHAIN,
        sourceId: `jaffa-${d[3]}${d[2]}${d[1]}${d[4]}${d[5]}-${id}`,
        sourceFilmId: filmId,
        venueId: JAFFA_CINEMA.id,
        startsAt,
        attrs: subbed ? ["subbed"] : [],
        // the screening's own page is where its tickets are sold
        bookingUrl: m[1],
      });
    }
    if (!found) continue;
    films.set(filmId, {
      chain: CHAIN,
      sourceId: filmId,
      title,
      year: year > 1900 ? year : undefined,
      runtime: minutes(meta.get("משך הקרנה") ?? ""),
      director: meta.get("בימוי") || undefined,
      synopsis: synopsis.slice(0, 900) || undefined,
      trailerUrl: trailer ? decode(trailer) : undefined,
      language,
      isEvent: false,
    });
  }

  return { chain: CHAIN, venues: screenings.length ? [JAFFA_CINEMA] : [], films: [...films.values()], screenings };
}
