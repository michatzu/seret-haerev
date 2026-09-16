import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Film, Screening, Snapshot, Venue } from "./types";

interface Loaded { key: string; snapshot: Snapshot; films: Map<string, Film>; venues: Map<string, Venue>; byFilm: Map<string, Screening[]> }
let cache: Loaded | null = null;

const FILE = path.join(process.cwd(), "data", "snapshot.json");
/** When set (production), the snapshot is fetched from here (e.g. the raw file on the repo's `data` branch). */
const URL = process.env.SNAPSHOT_URL;
const REVALIDATE_SECONDS = 600;

function index(snapshot: Snapshot, key: string): Loaded {
  const films = new Map(snapshot.films.map((f) => [f.id, f]));
  const venues = new Map(snapshot.venues.map((v) => [v.id, v]));
  const byFilm = new Map<string, Screening[]>();
  for (const s of snapshot.screenings) {
    const arr = byFilm.get(s.filmId);
    if (arr) arr.push(s);
    else byFilm.set(s.filmId, [s]);
  }
  return { key, snapshot, films, venues, byFilm };
}

/** Loads the snapshot: remote URL with 10-minute revalidation, else data/snapshot.json (re-read when it changes). */
export async function getData(): Promise<Loaded> {
  if (URL) {
    try {
      const res = await fetch(URL, { next: { revalidate: REVALIDATE_SECONDS } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const snapshot = (await res.json()) as Snapshot;
      if (cache && cache.key === snapshot.generatedAt) return cache;
      cache = index(snapshot, snapshot.generatedAt);
      return cache;
    } catch (e) {
      // The remote snapshot is the fresher copy, not the only one. Before the scrape has ever run
      // the branch does not exist yet, and later it could be briefly unreachable; either way the
      // schedule shipped with the build is far better than an error page.
      if (cache) return cache;
      console.warn("snapshot fetch failed, falling back to the bundled copy:", e instanceof Error ? e.message : e);
    }
  }
  const st = await stat(FILE);
  const key = String(st.mtimeMs);
  if (cache && cache.key === key) return cache;
  cache = index(JSON.parse(await readFile(FILE, "utf8")) as Snapshot, key);
  return cache;
}
