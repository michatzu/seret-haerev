export type Chain =
  | "planet"
  | "ravhen"
  | "cinemacity"
  | "hot"
  | "movieland"
  | "lev"
  | "cinematheque"
  | "other";

export type VenueKind = "multiplex" | "cinematheque" | "outdoor" | "boutique";

export interface Venue {
  id: string;
  chain: Chain;
  /** Display name, e.g. "רב חן דיזנגוף" */
  name: string;
  city: string;
  address?: string;
  lat: number;
  lng: number;
  kind: VenueKind;
  url?: string;
}

/** Screening-level attributes (hall type, format, language treatment). */
export type Attr =
  | "imax"
  | "4dx"
  | "vip"
  | "screenx"
  | "atmos"
  | "3d"
  | "35mm"
  | "outdoor"
  | "dubbed"
  | "subbed"
  | "live";

export interface FilmSource {
  chain: Chain;
  id: string;
  title: string;
}

export interface Film {
  id: string;
  title: string;
  originalTitle?: string;
  year?: number;
  country?: string;
  runtime?: number;
  /** Display labels (canonical Hebrew) */
  genres: string[];
  /** Canonical genre keys, see lib/genres.ts */
  genreKeys: string[];
  ageRating?: string;
  synopsis?: string;
  posterUrl?: string;
  /** Every poster candidate across chains, best first; served through /api/poster/[id] */
  posterUrls?: string[];
  trailerUrl?: string;
  imdbRating?: number;
  imdbVotes?: number;
  imdbId?: string;
  tmdbId?: number;
  tmdbPopularity?: number;
  backdropUrl?: string;
  director?: string;
  cast?: string[];
  /** alternate spellings of the title, director and cast, used for search but never shown */
  searchNames?: string[];
  /** Original spoken language (ISO 639-1) when known */
  language?: string;
  isKids: boolean;
  isIsraeli: boolean;
  /** Not a film: stand-up, opera broadcast, live show */
  isEvent: boolean;
  sources: FilmSource[];
}

export interface Screening {
  id: string;
  filmId: string;
  venueId: string;
  /** ISO 8601 with the Israel offset, e.g. 2026-09-13T18:15:00+03:00 */
  startsAt: string;
  attrs: Attr[];
  dubbedLang?: string;
  hall?: string;
  bookingUrl: string;
  soldOut?: boolean;
}

export interface SourceReport {
  /** the adapter's own label: several adapters share the "other" chain */
  chain: Chain | string;
  ok: boolean;
  films: number;
  screenings: number;
  ms: number;
  error?: string;
}

export interface Snapshot {
  generatedAt: string;
  venues: Venue[];
  films: Film[];
  screenings: Screening[];
  sources: SourceReport[];
}

/* ---- raw shapes produced by adapters, before films are unified across chains ---- */

export interface RawFilm {
  chain: Chain;
  sourceId: string;
  title: string;
  originalTitle?: string;
  year?: number;
  runtime?: number;
  genres?: string[];
  ageRating?: string;
  synopsis?: string;
  posterUrl?: string;
  trailerUrl?: string;
  director?: string;
  cast?: string[];
  /** alternate spellings of the title, director and cast, used for search but never shown */
  searchNames?: string[];
  language?: string;
  isKids?: boolean;
  isIsraeli?: boolean;
  isEvent?: boolean;
  /** For dubbed re-releases that the chain lists as a separate film (e.g. Russian dub) */
  aliasOfSourceId?: string;
}

export interface RawScreening {
  chain: Chain;
  sourceId: string;
  sourceFilmId: string;
  venueId: string;
  startsAt: string;
  attrs: Attr[];
  dubbedLang?: string;
  hall?: string;
  bookingUrl: string;
  soldOut?: boolean;
}

export interface AdapterResult {
  chain: Chain;
  venues: Venue[];
  films: RawFilm[];
  screenings: RawScreening[];
}
