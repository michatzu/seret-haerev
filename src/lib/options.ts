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

/**
 * The example shown in the empty search box. A fixed name would be a promise the catalogue cannot
 * keep: a placeholder is the first thing people actually type, and a retrospective that ended last
 * week would answer with nothing. So it names whoever is most screened right now, preferring a
 * person over a genre, which also teaches that the box takes names and not only titles.
 */
export function searchExample(films: Iterable<Film>): string {
  const people = new Map<string, number>();
  const genres = new Map<string, number>();
  for (const f of films) {
    if (f.isEvent) continue;
    for (const name of [...(f.director?.split(",") ?? []), ...(f.cast?.slice(0, 3) ?? [])]) {
      const n = name.trim();
      // a Hebrew spelling reads as an invitation; a Latin one looks like a stray string
      if (n.length > 4 && /^[֐-׿][֐-׿'"׳״\s-]+$/.test(n)) people.set(n, (people.get(n) ?? 0) + 1);
    }
    for (const g of f.genres) genres.set(g, (genres.get(g) ?? 0) + 1);
  }
  const best = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "he"))[0];
  const person = best(people);
  if (person && person[1] >= 2) return person[0];
  return best(genres)?.[0] ?? "אקשן";
}
