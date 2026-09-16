/**
 * A source that fails must not empty its cinemas off the site.
 *
 * Some of these sites answer a request from a data centre with 403 while answering the same request
 * from a home connection, so an hourly refresh can lose a chain for reasons that have nothing to do
 * with the cinema. Rather than publish a snapshot that quietly drops Movieland or Beit Gabriel, the
 * previous schedule for the venues that vanished is carried forward.
 *
 * It is carried for a day at most. A screening from a stale schedule is a small risk; a screening
 * from a schedule nobody has checked in a week is a broken promise, and the list is better off
 * admitting the cinema is missing.
 */
import type { Film, Screening, Snapshot, Venue } from "@/lib/types";

const MAX_AGE_HOURS = 24;

export interface CarryResult { venues: number; screenings: number; from?: string }

export function carryForward(fresh: Snapshot, previous: Snapshot | null, now = Date.now()): CarryResult {
  if (!previous?.generatedAt) return { venues: 0, screenings: 0 };
  const ageHours = (now - Date.parse(previous.generatedAt)) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours > MAX_AGE_HOURS || ageHours < 0) return { venues: 0, screenings: 0 };

  const liveVenues = new Set(fresh.screenings.map((s) => s.venueId));
  const missing = previous.venues.filter((v) => !liveVenues.has(v.id));
  if (!missing.length) return { venues: 0, screenings: 0, from: previous.generatedAt };

  const missingIds = new Set(missing.map((v) => v.id));
  const keep = previous.screenings.filter((s) => missingIds.has(s.venueId) && Date.parse(s.startsAt) > now);
  if (!keep.length) return { venues: 0, screenings: 0, from: previous.generatedAt };

  const haveFilm = new Map(fresh.films.map((f) => [f.id, f]));
  const haveVenue = new Set(fresh.venues.map((v) => v.id));
  const neededFilms = new Set(keep.map((s) => s.filmId));
  const addedVenues = new Set<string>();

  for (const v of missing) {
    if (!keep.some((s) => s.venueId === v.id) || haveVenue.has(v.id)) continue;
    fresh.venues.push(v);
    addedVenues.add(v.id);
  }
  for (const f of previous.films) {
    if (neededFilms.has(f.id) && !haveFilm.has(f.id)) fresh.films.push(f);
  }
  fresh.screenings.push(...keep);
  fresh.screenings.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return { venues: addedVenues.size || missing.length, screenings: keep.length, from: previous.generatedAt };
}

/** Types re-exported so the script can read a snapshot without importing three modules. */
export type { Film, Screening, Snapshot, Venue };
