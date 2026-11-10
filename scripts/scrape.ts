import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AdapterResult, Chain, RawScreening, Snapshot, SourceReport } from "@/lib/types";
import { PLANET, RAVHEN, scrapeCineworld } from "@/scraper/cineworld";
import { scrapeCinemaCity, scrapeHot, scrapeMovieland } from "@/scraper/modulus";
import { scrapeLev } from "@/scraper/lev";
import { scrapeCinematheques } from "@/scraper/cinematheques";
import { scrapeSecretTelAviv, scrapeTlvCity } from "@/scraper/popup";
import { scrapeHaifaFestival, scrapeJerusalemTheatre } from "@/scraper/festivals";
import { saveGeocodeCache } from "@/scraper/geocode";
import { scrapeSmarticket } from "@/scraper/smarticket";
import { scrapeBeitGabriel } from "@/scraper/betgabriel";
import { scrapeJaffaCinema } from "@/scraper/jaffacinema";
import { buildSnapshot, classifyAudience, mergeByTmdbId, mergeLabelledScreenings } from "@/scraper/normalize";
import { carryForward } from "@/scraper/carry";
import { rememberRetired } from "@/scraper/retired";
import { enrichFilms } from "@/scraper/tmdb";
import { fillPosters } from "@/scraper/posters";
import { addSummaries } from "@/scraper/summaries";
import { checkHealth } from "@/scraper/health";

/**
 * Every source the scraper reads, each with its own label. A source is the unit that is carried
 * forward when it fails and that the health check watches, so two feeds are two sources even when
 * they fill the same kind of venue: the municipality and Secret Tel Aviv were once one, and a
 * timeout on one took its venues off the site while the other kept the pair counted as read.
 * Where two sources list the same venue at the same minute, the one earlier here wins it.
 */
const tasks: { chain: Chain; label?: string; run: () => Promise<AdapterResult> }[] = [
  { chain: "planet", run: () => scrapeCineworld(PLANET) },
  { chain: "ravhen", run: () => scrapeCineworld(RAVHEN) },
  { chain: "cinemacity", run: scrapeCinemaCity },
  { chain: "hot", run: scrapeHot },
  { chain: "movieland", run: scrapeMovieland },
  { chain: "lev", run: scrapeLev },
  { chain: "cinematheque", run: scrapeCinematheques },
  { chain: "other", label: "tlv city", run: scrapeTlvCity },
  { chain: "other", label: "secret tlv", run: scrapeSecretTelAviv },
  { chain: "other", label: "haifa festival", run: scrapeHaifaFestival },
  { chain: "other", label: "jerusalem theatre", run: () => scrapeJerusalemTheatre() },
  { chain: "other", label: "smarticket", run: scrapeSmarticket },
  { chain: "other", label: "beit gabriel", run: scrapeBeitGabriel },
  { chain: "other", label: "jaffa cinema", run: scrapeJaffaCinema },
];

async function main() {
  const only = process.argv.slice(2);
  const selected = only.length ? tasks.filter((t) => only.includes(t.chain) || (t.label && only.includes(t.label))) : tasks;
  const outcomes = await Promise.all(
    selected.map(async (t): Promise<{ label: string; r?: AdapterResult; report: SourceReport }> => {
      const label = t.label ?? t.chain;
      const t0 = Date.now();
      try {
        const r = await t.run();
        return { label, r, report: { chain: label, ok: true, films: r.films.length, screenings: r.screenings.length, ms: Date.now() - t0 } };
      } catch (e) {
        return { label, report: { chain: label, ok: false, films: 0, screenings: 0, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) } };
      }
    }),
  );
  // the pop-up sources look up addresses they do not know; the answers are written once, here
  await saveGeocodeCache();
  const reports = outcomes.map((o) => o.report);

  // In the order of `tasks`, so that of two sources listing one night, the earlier keeps it.
  const results: AdapterResult[] = [];
  const venueSource: Record<string, string> = {};
  const warnings: Record<string, string[]> = {};
  const slot = (s: RawScreening) => `${s.venueId}|${s.startsAt}`;
  const taken = new Set<string>();
  for (const { label, r } of outcomes) {
    if (!r) continue;
    const screenings = r.screenings.filter((s) => !taken.has(slot(s)));
    for (const s of screenings) taken.add(slot(s));
    results.push({ ...r, screenings });
    // a venue is the source's that lists screenings there, not merely the place
    for (const v of r.venues) venueSource[v.id] ??= label;
    for (const s of screenings) venueSource[s.venueId] = label;
    if (r.warnings?.length) warnings[label] = r.warnings;
  }
  const snapshot = buildSnapshot(results, reports.sort((a, b) => a.chain.localeCompare(b.chain)));
  snapshot.venueSource = venueSource;

  // a source that failed should not take its cinemas off the site: keep what it said last time
  const previous = await readFile(path.join(process.cwd(), "data", "snapshot.json"), "utf8")
    .then((t) => JSON.parse(t) as Snapshot)
    .catch(() => null);
  // only a source that was not read this run — it failed, or a partial run left it out — is carried
  const read = new Set(reports.filter((r) => r.ok).map((r) => r.chain));
  const unreadTasks = tasks.filter((t) => !read.has(t.label ?? t.chain));
  const carried = carryForward(snapshot, previous, {
    labels: new Set(unreadTasks.map((t) => t.label ?? t.chain)),
    chains: new Set(unreadTasks.map((t) => t.chain)),
  });
  if (carried.screenings) console.log(`carried: ${carried.screenings} screenings at ${carried.venues} venues whose source failed, from ${carried.from}`);
  const t1 = Date.now();
  const enriched = await enrichFilms(snapshot.films);
  const mergedByTmdb = mergeByTmdbId(snapshot) + mergeLabelledScreenings(snapshot);
  classifyAudience(snapshot);
  console.log(enriched.skipped ? "enrich: skipped (no TMDB_API_KEY)" : `enrich: tmdb=${enriched.matched}/${snapshot.films.length} imdb=${enriched.rated} merged=${mergedByTmdb} ${Date.now() - t1}ms`);
  const t2 = Date.now();
  const retired = rememberRetired(snapshot, previous);
  const posters = await fillPosters(snapshot.films);
  console.log(`pages: posters=${posters.posters} synopses=${posters.synopses}, ${snapshot.films.filter((f) => !f.posterUrl && !f.isEvent).length} still missing ${Date.now() - t2}ms`);
  const t3 = Date.now();
  const sum = await addSummaries(snapshot.films);
  console.log(sum.skipped ? "summaries: skipped (no ANTHROPIC_API_KEY)" : `summaries: asked=${sum.asked} repaired=${sum.repaired} dropped=${sum.dropped} ${Date.now() - t3}ms`);
  // Only the run on GitHub can tell anybody (its failure sends an email), so only it marks a problem
  // as raised; a run from the home machine writes its problems to its log.
  snapshot.health = checkHealth({
    fresh: snapshot, previous, reports, warnings,
    labels: tasks.map((t) => t.label ?? t.chain),
    canAlert: process.env.GITHUB_ACTIONS === "true",
  });
  const out = path.join(process.cwd(), "data", "snapshot.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(snapshot));
  for (const r of reports) console.log(`${r.ok ? "ok " : "ERR"} ${r.chain.padEnd(17)} films=${String(r.films).padStart(4)} screenings=${String(r.screenings).padStart(5)} ${r.ms}ms ${r.error ?? ""}`);
  for (const p of snapshot.health.problems) console.log(`health: ${p}`);
  console.log(`snapshot: ${snapshot.films.length} films, ${snapshot.screenings.length} screenings, ${snapshot.venues.length} venues, ${retired} names kept for films that left -> ${path.relative(process.cwd(), out)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
