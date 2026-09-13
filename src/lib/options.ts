import "server-only";
import type { VenueOption } from "@/components/FilterSentence";
import type { Film, Venue } from "./types";
import { distanceKm, type LatLng } from "./geo";

/** Venues for the picker, nearest first. */
export function venueOptions(venues: Iterable<Venue>, here: LatLng): VenueOption[] {
  return [...venues].map((v) => ({ id: v.id, name: v.name, km: distanceKm(here, v) })).sort((a, b) => a.km - b.km);
}

/** Genre keys that actually occur among screened films. */
export function genreOptions(films: Iterable<Film>): string[] {
  const s = new Set<string>();
  for (const f of films) if (!f.isEvent) for (const g of f.genreKeys) s.add(g);
  return [...s];
}
