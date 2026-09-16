/**
 * Beit Gabriel on the Sea of Galilee, one of the busiest small cinemas in the country and for a
 * long time the hardest to reach: its listing used to come second-hand through seret.co.il, which
 * has since dropped the venue and answers with an empty schedule.
 *
 * Its own site turns out to be a Vue front end over a plain endpoint — one request returns every
 * showtime it has, the films they belong to, and the ticketing id for each.
 */
import type { AdapterResult, Attr, RawFilm, RawScreening, Venue } from "@/lib/types";
import { getJson } from "./http";
import { zonedToIso } from "@/lib/tz";
import { looksLikeEvent } from "./modulus";

const CHAIN = "other" as const;
const HOST = "https://www.betgabriel.co.il";
/** The ticket shop lives on its own domain, addressed by the show's tixEventId. */
const TICKETS = "https://gabriel.presglobal.store/order";
const DAYS = 45;

const VENUE: Venue = {
  chain: CHAIN,
  id: "bg-beit-gabriel",
  name: "בית גבריאל",
  city: "עמק הירדן",
  address: "צומת צמח",
  lat: 32.70452,
  lng: 35.58646,
  kind: "boutique",
  url: HOST,
};

interface BgShow {
  movieId: number;
  eventId: number;
  tixEventId: number;
  originalDateStr: string;
  hour: string;
  dubLanguage?: string | null;
  subLanguage?: string | null;
  languageDescription?: string | null;
}
interface BgMovie {
  id: number;
  name: string;
  picture?: string | null;
  originalName?: string | null;
  trailer?: string | null;
  synopsis?: string | null;
  lengthInMinutes?: number | null;
  rating?: string | null;
}
interface BgEvents {
  theaterShows?: BgShow[];
  slimMovieByIds?: BgMovie[];
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** The hall also sells concerts, guided walks and children's theatre; only its cinema page is film. */
async function cinemaMovieIds(): Promise<Set<number>> {
  const ids = new Set<number>();
  for (let page = 1; page <= 10; page++) {
    const list = await getJson<{ movies?: { id: number }[]; totalPages?: number }>(
      `${HOST}/GetShowlistMoviesVue?showListType=ShowingNow&page=${page}&theaterId=0&vodCategoryId=0&categoryId=0`,
    );
    for (const m of list.movies ?? []) ids.add(m.id);
    if (page >= (list.totalPages ?? 1)) break;
  }
  return ids;
}

/** Their Hebrew print of a film carries the language as a suffix, in both languages. */
const stripDubSuffix = (t: string) => t.replace(/\s+עברית$/u, "").replace(/\s+heb$/iu, "").trim();

export async function scrapeBeitGabriel(): Promise<AdapterResult> {
  const [data, cinema] = await Promise.all([
    getJson<BgEvents>(`${HOST}/ticket/GetMyFilteredEvents?theaterId=0&dateStr=&movieId=0&forceDateSelection=false`),
    cinemaMovieIds().catch(() => new Set<number>()),
  ]);
  const shows = data.theaterShows ?? [];
  const catalogue = new Map((data.slimMovieByIds ?? []).map((m) => [m.id, m]));
  if (!shows.length) throw new Error("beit gabriel: no showtimes in the listing");

  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const now = Date.now();
  const horizon = now + DAYS * 864e5;

  for (const s of shows) {
    const movie = catalogue.get(s.movieId);
    const title = stripDubSuffix(clean(movie?.name));
    if (!title) continue;
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.originalDateStr ?? "");
    const hm = /^(\d{1,2}):(\d{2})/.exec(s.hour ?? "");
    if (!d || !hm) continue;
    const startsAt = zonedToIso(+d[1], +d[2], +d[3], +hm[1], +hm[2]);
    const at = Date.parse(startsAt);
    if (!Number.isFinite(at) || at < now - 3600_000 || at > horizon) continue;

    const filmId = `bg-${s.movieId}`;
    if (!films.has(filmId)) {
      films.set(filmId, {
        chain: CHAIN,
        sourceId: filmId,
        title,
        originalTitle: stripDubSuffix(clean(movie?.originalName)) || undefined,
        runtime: movie?.lengthInMinutes && movie.lengthInMinutes > 30 ? movie.lengthInMinutes : undefined,
        posterUrl: movie?.picture ? `${HOST}/cache/w_300,h_450,mode_crop/${encodeURIComponent(movie.picture)}` : undefined,
        synopsis: clean(movie?.synopsis).slice(0, 900) || undefined,
        trailerUrl: clean(movie?.trailer) || undefined,
        ageRating: clean(movie?.rating) || undefined,
        // Anything the cinema page does not carry is a concert, a walk or a play, not a film.
        isEvent: (cinema.size > 0 && !cinema.has(s.movieId)) || looksLikeEvent(title),
      });
    }

    // "מדובב (עברית) עם כתוביות (עברית)" — the two fields say it on their own, in the same words.
    const dubbed = clean(s.dubLanguage);
    const subbed = clean(s.subLanguage);
    const attrs: Attr[] = [];
    if (dubbed) attrs.push("dubbed");
    if (subbed) attrs.push("subbed");
    screenings.push({
      chain: CHAIN,
      sourceId: `bg-${s.eventId}`,
      sourceFilmId: filmId,
      venueId: VENUE.id,
      startsAt,
      attrs,
      dubbedLang: dubbed === "עברית" ? "he" : undefined,
      bookingUrl: `${TICKETS}/${s.tixEventId}`,
    });
  }

  return { chain: CHAIN, venues: screenings.length ? [VENUE] : [], films: [...films.values()], screenings };
}
