/**
 * seret.co.il indexes the schedules of venues that publish nothing usable themselves. Beit Gabriel
 * on the Sea of Galilee is the case that matters: it is one of the busiest small cinemas in the
 * country and its own site sits behind a firewall that refuses every request from here.
 *
 * The listing is one AJAX fragment per venue, in windows-1255, covering the current week only.
 */
import type { AdapterResult, Attr, RawFilm, RawScreening, Venue } from "@/lib/types";
import { zonedToIso } from "@/lib/tz";
import { shortHash } from "@/lib/text";
import { looksLikeEvent } from "./modulus";

const CHAIN = "other" as const;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

interface SeretVenue { tid: number; venue: Omit<Venue, "chain"> }

const VENUES: SeretVenue[] = [
  {
    tid: 43,
    venue: { id: "seret-beit-gabriel", name: "בית גבריאל", city: "עמק הירדן", address: "צומת צמח", lat: 32.70452, lng: 35.58646, kind: "boutique", url: "https://www.betgabriel.co.il" },
  },
];

/** One film block: everything from its title anchor up to the next one. */
const BLOCK = /<a href="s_movies\.asp\?MID=(\d+)"[^>]*class="TitGreen20"[^>]*>([^<]+)<\/a>([\s\S]*?)(?=<a href="s_movies\.asp\?MID=\d+"[^>]*class="TitGreen20"|$)/g;
// each showtime carries its own hall, so the hall is captured inside the match rather than once
const SHOWTIME = /<div class="stbox"\s+title="(\d{1,2})\/(\d{1,2})\/(\d{4})([^"]*)"[^>]*>\s*<span class="hour">\s*(\d{1,2}):(\d{2})\s*<\/span>(?:[\s\S]{0,120}?title="אולם הקרנה"[^>]*>([^<]+)<)?/g;
const AGE = /class="movienotice"[^>]*title="\*?\s*([^"|]+)/;
const POSTER = /<img[^>]+data-src="([^"]+\.(?:jpe?g|png|webp))"/;

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
const text = (s: string) => decode(s).replace(/\s+/g, " ").trim();

/** The page is windows-1255, which fetch will not decode for us. */
async function getWindows1255(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new TextDecoder("windows-1255").decode(await res.arrayBuffer());
}

async function scrapeVenue(v: SeretVenue): Promise<AdapterResult> {
  const html = await getWindows1255(`https://www.seret.co.il/movies/movieTableAjax2.asp?f_tid=${v.tid}&d=&s=&v=&st=1&tst=`);
  const venue: Venue = { chain: CHAIN, ...v.venue };
  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const now = Date.now();
  const horizon = now + 21 * 864e5;

  BLOCK.lastIndex = 0;
  for (const m of html.matchAll(BLOCK)) {
    const [, mid, rawTitle, body] = m;
    const title = text(rawTitle);
    if (!title) continue;
    const filmId = `seret-${mid}`;
    const poster = POSTER.exec(body)?.[1];

    SHOWTIME.lastIndex = 0;
    for (const t of body.matchAll(SHOWTIME)) {
      const [, dd, mm, yyyy, note, hh, min, hall] = t;
      const startsAt = zonedToIso(Number(yyyy), Number(mm), Number(dd), Number(hh), Number(min));
      const at = Date.parse(startsAt);
      if (!Number.isFinite(at) || at < now - 3600_000 || at > horizon) continue;
      const dubbed = /מדובב/.test(note);
      const attrs: Attr[] = dubbed ? ["dubbed"] : ["subbed"];

      if (!films.has(filmId)) {
        films.set(filmId, {
          chain: CHAIN,
          sourceId: filmId,
          title,
          ageRating: AGE.exec(body)?.[1] ? text(AGE.exec(body)![1]) : undefined,
          posterUrl: poster ? new URL(poster.replace(/^\.\.\//, "/"), "https://www.seret.co.il/").toString() : undefined,
          isEvent: looksLikeEvent(title),
        });
      }
      screenings.push({
        chain: CHAIN,
        sourceId: `seret-${shortHash(`${filmId}${startsAt}`)}`,
        sourceFilmId: filmId,
        venueId: venue.id,
        startsAt,
        attrs,
        dubbedLang: dubbed ? "he" : undefined,
        hall: hall ? text(hall) : undefined,
        // small venues carry no booking link here, so the cinema's own site is the honest target
        bookingUrl: venue.url ?? "https://www.seret.co.il",
      });
    }
  }
  if (!screenings.length) throw new Error(`seret ${v.tid}: nothing parsed`);
  return { chain: CHAIN, venues: [venue], films: [...films.values()], screenings };
}

export async function scrapeSeret(): Promise<AdapterResult> {
  const parts = await Promise.allSettled(VENUES.map(scrapeVenue));
  for (const [i, p] of parts.entries()) {
    if (p.status === "rejected") console.warn(`  seret ${VENUES[i].venue.name} failed:`, p.reason instanceof Error ? p.reason.message : p.reason);
  }
  const ok = parts.filter((p): p is PromiseFulfilledResult<AdapterResult> => p.status === "fulfilled").map((p) => p.value);
  if (!ok.length) throw new Error("every seret venue failed");
  return {
    chain: CHAIN,
    venues: ok.flatMap((r) => r.venues),
    films: ok.flatMap((r) => r.films),
    screenings: ok.flatMap((r) => r.screenings),
  };
}
