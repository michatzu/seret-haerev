import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Film, Screening, Snapshot, Venue } from "./types";

let cache: { mtimeMs: number; snapshot: Snapshot; films: Map<string, Film>; venues: Map<string, Venue>; byFilm: Map<string, Screening[]> } | null = null;

const FILE = path.join(process.cwd(), "data", "snapshot.json");

/** Loads data/snapshot.json (re-read when the file changes). */
export async function getData() {
  const { stat } = await import("node:fs/promises");
  const st = await stat(FILE);
  if (cache && cache.mtimeMs === st.mtimeMs) return cache;
  const snapshot = JSON.parse(await readFile(FILE, "utf8")) as Snapshot;
  const films = new Map(snapshot.films.map((f) => [f.id, f]));
  const venues = new Map(snapshot.venues.map((v) => [v.id, v]));
  const byFilm = new Map<string, Screening[]>();
  for (const s of snapshot.screenings) {
    const arr = byFilm.get(s.filmId);
    if (arr) arr.push(s);
    else byFilm.set(s.filmId, [s]);
  }
  cache = { mtimeMs: st.mtimeMs, snapshot, films, venues, byFilm };
  return cache;
}
