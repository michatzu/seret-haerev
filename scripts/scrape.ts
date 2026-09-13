import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AdapterResult, Chain, SourceReport } from "@/lib/types";
import { PLANET, RAVHEN, scrapeCineworld } from "@/scraper/cineworld";
import { scrapeCinemaCity, scrapeHot, scrapeMovieland } from "@/scraper/modulus";
import { scrapeLev } from "@/scraper/lev";
import { buildSnapshot } from "@/scraper/normalize";

const tasks: { chain: Chain; run: () => Promise<AdapterResult> }[] = [
  { chain: "planet", run: () => scrapeCineworld(PLANET) },
  { chain: "ravhen", run: () => scrapeCineworld(RAVHEN) },
  { chain: "cinemacity", run: scrapeCinemaCity },
  { chain: "hot", run: scrapeHot },
  { chain: "movieland", run: scrapeMovieland },
  { chain: "lev", run: scrapeLev },
];

async function main() {
  const only = process.argv.slice(2);
  const selected = only.length ? tasks.filter((t) => only.includes(t.chain)) : tasks;
  const results: AdapterResult[] = [];
  const reports: SourceReport[] = [];
  await Promise.all(
    selected.map(async (t) => {
      const t0 = Date.now();
      try {
        const r = await t.run();
        results.push(r);
        reports.push({ chain: t.chain, ok: true, films: r.films.length, screenings: r.screenings.length, ms: Date.now() - t0 });
      } catch (e) {
        reports.push({ chain: t.chain, ok: false, films: 0, screenings: 0, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
      }
    }),
  );
  const snapshot = buildSnapshot(results, reports.sort((a, b) => a.chain.localeCompare(b.chain)));
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
