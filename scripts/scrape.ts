import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AdapterResult, Chain, SourceReport } from "@/lib/types";
import { PLANET, RAVHEN, scrapeCineworld } from "@/scraper/cineworld";
import { scrapeCinemaCity, scrapeHot, scrapeMovieland } from "@/scraper/modulus";
import { scrapeLev } from "@/scraper/lev";
import { scrapeCinematheques } from "@/scraper/cinematheques";
import { scrapePopup } from "@/scraper/popup";
import { scrapeSmarticket } from "@/scraper/smarticket";
import { scrapeSeret } from "@/scraper/seret";
import { buildSnapshot, mergeByTmdbId } from "@/scraper/normalize";
import { enrichFilms } from "@/scraper/tmdb";
import { fillPosters } from "@/scraper/posters";

const tasks: { chain: Chain; label?: string; run: () => Promise<AdapterResult> }[] = [
  { chain: "planet", run: () => scrapeCineworld(PLANET) },
  { chain: "ravhen", run: () => scrapeCineworld(RAVHEN) },
  { chain: "cinemacity", run: scrapeCinemaCity },
  { chain: "hot", run: scrapeHot },
  { chain: "movieland", run: scrapeMovieland },
  { chain: "lev", run: scrapeLev },
  { chain: "cinematheque", run: scrapeCinematheques },
  { chain: "other", label: "popup", run: scrapePopup },
  { chain: "other", label: "smarticket", run: scrapeSmarticket },
  { chain: "other", label: "seret", run: scrapeSeret },
];

async function main() {
  const only = process.argv.slice(2);
  const selected = only.length ? tasks.filter((t) => only.includes(t.chain) || (t.label && only.includes(t.label))) : tasks;
  const results: AdapterResult[] = [];
  const reports: SourceReport[] = [];
  await Promise.all(
    selected.map(async (t) => {
      const t0 = Date.now();
      try {
        const r = await t.run();
        results.push(r);
        reports.push({ chain: t.label ?? t.chain, ok: true, films: r.films.length, screenings: r.screenings.length, ms: Date.now() - t0 });
      } catch (e) {
        reports.push({ chain: t.label ?? t.chain, ok: false, films: 0, screenings: 0, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
      }
    }),
  );
  const snapshot = buildSnapshot(results, reports.sort((a, b) => a.chain.localeCompare(b.chain)));
  const t1 = Date.now();
  const enriched = await enrichFilms(snapshot.films);
  const mergedByTmdb = mergeByTmdbId(snapshot);
  console.log(enriched.skipped ? "enrich: skipped (no TMDB_API_KEY)" : `enrich: tmdb=${enriched.matched}/${snapshot.films.length} imdb=${enriched.rated} merged=${mergedByTmdb} ${Date.now() - t1}ms`);
  const t2 = Date.now();
  const posters = await fillPosters(snapshot.films);
  console.log(`pages: posters=${posters.posters} synopses=${posters.synopses}, ${snapshot.films.filter((f) => !f.posterUrl && !f.isEvent).length} still missing ${Date.now() - t2}ms`);
  const out = path.join(process.cwd(), "data", "snapshot.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(snapshot));
  for (const r of reports) console.log(`${r.ok ? "ok " : "ERR"} ${r.chain.padEnd(11)} films=${String(r.films).padStart(4)} screenings=${String(r.screenings).padStart(5)} ${r.ms}ms ${r.error ?? ""}`);
  console.log(`snapshot: ${snapshot.films.length} films, ${snapshot.screenings.length} screenings, ${snapshot.venues.length} venues -> ${path.relative(process.cwd(), out)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
