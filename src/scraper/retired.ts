/**
 * The names of films that have stopped playing.
 *
 * A viewer's own lists outlive the schedule: a film marked in March is gone from every cinema by
 * May, and the site would have nothing left to call it. So each run writes down the name of every
 * film it publishes, and carries forward the names of the ones that have since left. Names, years
 * and the date each was last seen — nothing else, and nothing that grows without end.
 */
import type { Snapshot } from "@/lib/types";

/** Long enough to cover a list somebody forgot about for a season or two. */
const KEEP_MONTHS = 18;

export function rememberRetired(snapshot: Snapshot, previous: Snapshot | null, now = new Date()): number {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - KEEP_MONTHS);
  const today = now.toISOString().slice(0, 10);

  const kept = new Map<string, { title: string; year?: number; seen: string; poster?: string }>();
  for (const [id, v] of Object.entries(previous?.retired ?? {})) {
    if (!v?.title) continue;
    const seen = typeof v.seen === "string" ? v.seen : today;
    if (new Date(seen) >= cutoff) kept.set(id, { title: v.title, year: v.year, seen, poster: v.poster });
  }
  // the last run's own films, which is where a film that left this week is caught
  const lastSeen = (previous?.generatedAt ?? today).slice(0, 10);
  for (const f of previous?.films ?? []) {
    if (!f.isEvent && f.title) kept.set(f.id, { title: f.title, year: f.year, seen: lastSeen, poster: f.posterUrl });
  }
  for (const f of snapshot.films) {
    if (!f.isEvent) kept.set(f.id, { title: f.title, year: f.year, seen: today, poster: f.posterUrl });
  }

  // the snapshot carries only the names it no longer lists itself
  const playing = new Set(snapshot.films.map((f) => f.id));
  const retired: NonNullable<Snapshot["retired"]> = {};
  for (const [id, v] of kept) if (!playing.has(id)) retired[id] = v;
  snapshot.retired = retired;
  return Object.keys(retired).length;
}
