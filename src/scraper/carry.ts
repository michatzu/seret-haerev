/**
 * A source that fails must not empty its cinemas off the site.
 *
 * Movieland and Secret Tel Aviv sit behind Cloudflare's bot challenge, which passes a
 * home connection and stops any data centre, so the hourly refresh on GitHub cannot reach them at
 * all. That is a protection their operators chose and this project does not try to defeat it; what
 * it does instead is refuse to publish a snapshot that quietly drops those cinemas, by carrying
 * their previous schedule forward.
 *
 * It is carried for a day at most. A screening from a stale schedule is a small risk; a screening
 * from a schedule nobody has checked in a week is a broken promise, and the list is better off
 * admitting the cinema is missing.
 *
 * The day is counted from when the schedule was last actually read, which the snapshot keeps per
 * venue in `carried`. Counting from the previous snapshot instead let every hourly run restart the
 * clock, and a chain whose feed had moved was carried for weeks, shrinking to a few leftovers.
 */
import type { Film, Screening, Snapshot, Venue } from "@/lib/types";

const MAX_AGE_HOURS = 24;

export interface CarryResult { venues: number; screenings: number; from?: string }

/** The sources that were not read this run (failed, or left out of a partial run), by label and by chain. */
export interface Unread { labels: Set<string>; chains: Set<string> }

export function carryForward(fresh: Snapshot, previous: Snapshot | null, unread: Unread, now = Date.now()): CarryResult {
  if (!previous?.generatedAt) return { venues: 0, screenings: 0 };
  const hoursSince = (iso: string) => (now - Date.parse(iso)) / 3_600_000;
  const ageHours = hoursSince(previous.generatedAt);
  if (!Number.isFinite(ageHours) || ageHours > MAX_AGE_HOURS || ageHours < 0) return { venues: 0, screenings: 0 };

  /** When this venue's schedule was last read from its source, not merely republished. */
  const readAt = (id: string) => previous.carried?.[id] ?? previous.generatedAt;
  // A snapshot from before sources were recorded can only be judged by chain, which is coarse for
  // the several adapters that share "other"; it is a one-run fallback.
  const sourceUnread = (v: Venue) => {
    const label = previous.venueSource?.[v.id];
    return label ? unread.labels.has(label) : unread.chains.has(v.chain);
  };
  const liveVenues = new Set(fresh.screenings.map((s) => s.venueId));
  const missing = previous.venues.filter((v) => !liveVenues.has(v.id) && sourceUnread(v) && hoursSince(readAt(v.id)) <= MAX_AGE_HOURS);
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
  const carried = { ...fresh.carried };
  const venueSource = { ...fresh.venueSource };
  for (const id of new Set(keep.map((s) => s.venueId))) {
    carried[id] = readAt(id);
    const label = previous.venueSource?.[id];
    if (label) venueSource[id] = label;
  }
  fresh.carried = carried;
  fresh.venueSource = venueSource;
  const oldest = Object.values(carried).sort()[0];

  return { venues: addedVenues.size || missing.length, screenings: keep.length, from: oldest ?? previous.generatedAt };
}

/** Types re-exported so the script can read a snapshot without importing three modules. */
export type { Film, Screening, Snapshot, Venue };
