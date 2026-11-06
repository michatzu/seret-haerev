/**
 * Is every source still being read, and still saying as much as it used to?
 *
 * The failures that cost the most here were quiet ones. Cinema City's feed moved and the chain was
 * carried forward for days before anyone noticed; seven SmarTicket halls and three cinematheques
 * answered "ok" with a fraction of their schedule. So each run writes down when every source was
 * last read, compares what it got with the run before, and collects what an adapter skipped
 * because it did not recognise it (a new branch, typically).
 *
 * A problem is raised once, then again a day later if it is still there — an hourly job that
 * failed every hour would teach its reader to ignore it. Only a run that can tell somebody (the one
 * on GitHub, whose failure sends an email) marks a problem as raised; a run from the home machine
 * reports to its log and leaves the raising to GitHub.
 */
import type { Health, Snapshot, SourceReport } from "@/lib/types";

/** Hours without a successful read before a source is a problem. */
const STALE_HOURS = 3;
/** Read only from the home machine, once a day when it is on (scripts/refresh-local.sh). */
const HOME_ONLY_STALE_HOURS: Record<string, number> = { movieland: 48, "jaffa cinema": 48 };
/** A source whose screenings fall below this share of the previous run's, from at least MIN_BASE. */
const DROP_RATIO = 0.5;
const MIN_BASE = 30;
/** A venue that had this many screenings ahead and now has none, though its source was read. */
const VENUE_MIN_BASE = 15;
const REPEAT_HOURS = 24;
const FORGET_DAYS = 7;

export interface HealthInput {
  fresh: Snapshot;
  previous: Snapshot | null;
  /** every source the scraper knows, by label, whether or not this run included it */
  labels: string[];
  reports: SourceReport[];
  /** what each adapter skipped and wants a person to look at, by label */
  warnings: Record<string, string[]>;
  /** whether this run can tell anybody (and so may mark problems as raised) */
  canAlert: boolean;
  now?: number;
}

export function checkHealth({ fresh, previous, labels, reports, warnings, canAlert, now = Date.now() }: HealthInput): Health {
  const iso = new Date(now).toISOString();
  const hoursSince = (t: string) => (now - Date.parse(t)) / 3_600_000;
  const report = new Map(reports.map((r) => [r.chain, r]));
  const before = new Map((previous?.sources ?? []).map((r) => [r.chain, r]));
  const problems: { key: string; text: string }[] = [];

  // when each source was last read; a snapshot from before this existed is read from its reports
  const lastOk: Record<string, string> = { ...previous?.health?.lastOk };
  if (!previous?.health) for (const r of previous?.sources ?? []) if (r.ok && previous?.generatedAt) lastOk[r.chain] = previous.generatedAt;
  for (const r of reports) if (r.ok) lastOk[r.chain] = iso;

  for (const label of labels) {
    const r = report.get(label);
    if (r?.ok) continue;
    const limit = HOME_ONLY_STALE_HOURS[label] ?? STALE_HOURS;
    const last = lastOk[label];
    if (last && hoursSince(last) <= limit) continue;
    if (!last && !r) continue; // never run, and not run now: a partial run, nothing to say
    const since = last ? `not read for ${Math.round(hoursSince(last))}h (last ${last.slice(0, 16)}Z)` : "has never been read";
    problems.push({ key: `stale:${label}`, text: `${label} ${since}${r?.error ? `: ${r.error.slice(0, 160)}` : ""}` });
  }

  for (const r of reports) {
    const b = before.get(r.chain);
    if (!r.ok || !b?.ok || b.screenings < MIN_BASE) continue;
    if (r.screenings < b.screenings * DROP_RATIO) {
      problems.push({ key: `drop:${r.chain}`, text: `${r.chain} returned ${r.screenings} screenings, down from ${b.screenings} the run before` });
    }
  }

  // a venue that went silent while its source answered: a renamed branch, a changed filter
  if (previous) {
    const ahead = (s: Snapshot) => {
      const n = new Map<string, number>();
      for (const x of s.screenings) if (Date.parse(x.startsAt) > now) n.set(x.venueId, (n.get(x.venueId) ?? 0) + 1);
      return n;
    };
    const was = ahead(previous), is = ahead(fresh);
    const names = new Map(previous.venues.map((v) => [v.id, v.name]));
    for (const [id, n] of was) {
      if (n < VENUE_MIN_BASE || is.get(id) || previous.carried?.[id] || fresh.carried?.[id]) continue;
      const label = previous.venueSource?.[id];
      if (!label || !report.get(label)?.ok) continue;
      problems.push({ key: `venue:${id}`, text: `${names.get(id) ?? id} (${id}) has no screenings ahead, from ${n} the run before, though ${label} was read` });
    }
  }

  for (const [label, list] of Object.entries(warnings)) {
    for (const w of list) problems.push({ key: `warn:${label}:${w}`, text: `${label}: ${w}` });
  }

  // raise each problem once, and again after a day if it is still there
  const alerted: Record<string, string> = {};
  for (const [k, t] of Object.entries(previous?.health?.alerted ?? {})) if (hoursSince(t) < FORGET_DAYS * 24) alerted[k] = t;
  const alerts: string[] = [];
  for (const p of problems) {
    const last = alerted[p.key];
    if (last && hoursSince(last) < REPEAT_HOURS) continue;
    alerts.push(p.text);
    if (canAlert) alerted[p.key] = iso;
  }

  return { lastOk, alerted, problems: problems.map((p) => p.text), alerts: canAlert ? alerts : [] };
}
