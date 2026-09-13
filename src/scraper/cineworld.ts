/**
 * Cineworld "quickbook" data API, used by Planet (יס פלאנט) and Rav-Hen.
 * Same catalogue, different tenants and URL prefixes.
 */
import type { AdapterResult, Attr, Chain, RawFilm, RawScreening, Venue } from "@/lib/types";
import { VENUE_BY_ID } from "@/data/venues";
import { localIsoToIso, ymdPlusDays } from "@/lib/tz";
import { getJson, pool } from "./http";
import { hasCyrillic } from "@/lib/text";

interface Tenant {
  chain: Chain;
  base: string;
  prefix: string;
  tenant: string;
  venuePrefix: string;
}

export const PLANET: Tenant = { chain: "planet", base: "https://www.planetcinema.co.il", prefix: "il", tenant: "10100", venuePrefix: "planet" };
export const RAVHEN: Tenant = { chain: "ravhen", base: "https://www.rav-hen.co.il", prefix: "rh", tenant: "10104", venuePrefix: "ravhen" };

interface CwCinema {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  address?: string;
  addressInfo?: { city?: string };
  link?: string;
}
interface CwFilm {
  id: string;
  name: string;
  length?: number;
  posterLink?: string;
  videoLink?: string;
  link?: string;
  releaseYear?: string | number;
  attributeIds?: string[];
}
interface CwEvent {
  id: string;
  filmId: string;
  cinemaId: string;
  eventDateTime: string;
  attributeIds?: string[];
  bookingLink?: string;
  soldOut?: boolean;
  auditorium?: string;
  languages?: { original?: string; dubbed?: string; voiceover?: string; subtitles?: string[] };
}

const GENRES: Record<string, string> = {
  action: "אקשן", adventure: "הרפתקאות", animation: "אנימציה", comedy: "קומדיה", crime: "פשע",
  documentary: "דוקומנטרי", drama: "דרמה", family: "לכל המשפחה", fantasy: "פנטזיה", history: "היסטוריה",
  horror: "אימה", music: "מוזיקה", musical: "מחזמר", mystery: "מסתורין", romance: "רומנטי",
  "sci-fi": "מדע בדיוני", thriller: "מתח", war: "מלחמה", western: "מערבון", concert: "הופעה", opera: "אופרה",
};
const AGE: Record<string, string> = { all: "לכל הגילאים", "9-plus": "9+", "12-plus": "12+", "14-plus": "14+", "16-plus": "16+", "18-plus": "18+" };

function screeningAttrs(ids: string[] = []): { attrs: Attr[]; dubbedLang?: string } {
  const attrs = new Set<Attr>();
  let dubbedLang: string | undefined;
  for (const id of ids) {
    if (id === "imax") attrs.add("imax");
    else if (id === "4dx") attrs.add("4dx");
    else if (id === "vip" || id === "vip-light") attrs.add("vip");
    else if (id === "screenx") attrs.add("screenx");
    else if (id === "3d") attrs.add("3d");
    else if (id.includes("atmos")) attrs.add("atmos");
    else if (id === "dubbed") attrs.add("dubbed");
    else if (id === "subbed") attrs.add("subbed");
    else if (id.startsWith("dubbed-lang-")) dubbedLang = id.slice("dubbed-lang-".length);
  }
  return { attrs: [...attrs], dubbedLang };
}

function filmFromCw(chain: Chain, f: CwFilm): RawFilm {
  const ids = f.attributeIds ?? [];
  const genres = ids.filter((a) => GENRES[a]).map((a) => GENRES[a]);
  const age = ids.find((a) => AGE[a]);
  const lang = ids.find((a) => a.startsWith("original-lang-"))?.slice("original-lang-".length);
  const dubbedHe = ids.includes("dubbed-lang-he") || (ids.includes("dubbed") && !ids.some((a) => a.startsWith("dubbed-lang-") && a !== "dubbed-lang-he"));
  const year = f.releaseYear ? Number(f.releaseYear) : undefined;
  const raw: RawFilm = {
    chain,
    sourceId: f.id,
    title: f.name.trim(),
    year: Number.isFinite(year) ? year : undefined,
    runtime: f.length || undefined,
    genres,
    ageRating: age ? AGE[age] : undefined,
    posterUrl: f.posterLink || undefined,
    trailerUrl: f.videoLink || undefined,
    language: lang,
    isIsraeli: ids.includes("israeli"),
    isKids: dubbedHe || ids.includes("family") || ids.includes("animation"),
  };
  // Russian-dubbed re-release listed as its own film ("ОДИССЕЯ - The Odyssey", id 7460s2r2 -> base 7460s2r)
  if (hasCyrillic(f.name)) {
    const m = /^(\d+[a-z]\d[a-z])\d+$/i.exec(f.id);
    if (m) raw.aliasOfSourceId = m[1];
    const latin = f.name.split(" - ").slice(1).join(" - ").trim();
    if (latin) raw.originalTitle = latin;
  }
  return raw;
}

export async function scrapeCineworld(t: Tenant, days = 8): Promise<AdapterResult> {
  const api = `${t.base}/${t.prefix}/data-api-service/v1/quickbook/${t.tenant}`;
  const until = ymdPlusDays(days);
  const { body } = await getJson<{ body: { cinemas: CwCinema[] } }>(`${api}/cinemas/with-event/until/${until}?attr=&lang=he_IL`);

  const venues: Venue[] = body.cinemas.map((c) => {
    const id = `${t.venuePrefix}-${c.id}`;
    const known = VENUE_BY_ID.get(id);
    return {
      id,
      chain: t.chain,
      name: known?.name ?? c.displayName,
      city: known?.city ?? c.addressInfo?.city ?? "",
      address: known?.address ?? c.address,
      lat: Number(c.latitude) || known?.lat || 0,
      lng: Number(c.longitude) || known?.lng || 0,
      kind: known?.kind ?? "multiplex",
      url: c.link ? `${t.base}${c.link}` : undefined,
    };
  });

  const jobs: { cinema: CwCinema; date: string }[] = [];
  for (const cinema of body.cinemas) for (let i = 0; i < days; i++) jobs.push({ cinema, date: ymdPlusDays(i) });

  const films = new Map<string, RawFilm>();
  const screenings: RawScreening[] = [];
  const results = await pool(jobs, 4, async ({ cinema, date }) => {
    const r = await getJson<{ body: { films: CwFilm[]; events: CwEvent[] } }>(`${api}/film-events/in-cinema/${cinema.id}/at-date/${date}?attr=&lang=he_IL`);
    for (const f of r.body.films) if (!films.has(f.id)) films.set(f.id, filmFromCw(t.chain, f));
    for (const e of r.body.events) {
      const { attrs, dubbedLang } = screeningAttrs(e.attributeIds);
      if (!e.bookingLink) continue;
      screenings.push({
        chain: t.chain,
        sourceId: e.id,
        sourceFilmId: e.filmId,
        venueId: `${t.venuePrefix}-${e.cinemaId}`,
        startsAt: localIsoToIso(e.eventDateTime),
        attrs,
        dubbedLang,
        hall: e.auditorium || undefined,
        bookingUrl: e.bookingLink,
        soldOut: e.soldOut || undefined,
      });
    }
  });
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed && failed === results.length) throw new Error(`all ${failed} day requests failed`);

  return { chain: t.chain, venues, films: [...films.values()], screenings };
}
