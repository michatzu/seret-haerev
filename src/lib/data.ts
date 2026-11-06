import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Film, Screening, Snapshot, Venue } from "./types";

interface Loaded {
  key: string; snapshot: Snapshot; films: Map<string, Film>; venues: Map<string, Venue>; byFilm: Map<string, Screening[]>;
  /** Venues with at least one film on their schedule, as opposed to only shows, talks and stage events. */
  screening: Set<string>;
}
let cache: Loaded | null = null;

const FILE = path.join(process.cwd(), "data", "snapshot.json");
/** When set (production), the snapshot is fetched from here (e.g. the raw file on the repo's `data` branch). */
const URL = process.env.SNAPSHOT_URL;
/** Needed only while the repository is private: raw.githubusercontent answers 404 without it. */
const TOKEN = process.env.SNAPSHOT_TOKEN;
const REVALIDATE_SECONDS = 600;

function index(snapshot: Snapshot, key: string): Loaded {
  const films = new Map(snapshot.films.map((f) => [f.id, f]));
  const venues = new Map(snapshot.venues.map((v) => [v.id, v]));
  const byFilm = new Map<string, Screening[]>();
  const screening = new Set<string>();
  for (const s of snapshot.screenings) {
    const arr = byFilm.get(s.filmId);
    if (arr) arr.push(s);
    else byFilm.set(s.filmId, [s]);
    if (films.get(s.filmId)?.isEvent === false) screening.add(s.venueId);
  }
  return { key, snapshot, films, venues, byFilm, screening };
}

/**
 * The remote snapshot, kept here rather than in Next's data cache. That cache refuses anything over
 * 2 MB, and refuses it quietly: it went on serving the last copy small enough to store — the
 * schedule of 2 November — while every revalidation fetched a fresh one and threw it away. So each
 * server instance keeps the parsed snapshot itself, asks again after ten minutes, and sends the
 * ETag along, so an unchanged file costs a 304 rather than three megabytes.
 */
let remote: { at: number; etag?: string } | null = null;
let inflight: Promise<Loaded> | null = null;

async function fromRemote(url: string): Promise<Loaded> {
  const headers: Record<string, string> = {};
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  if (cache && remote?.etag) headers["if-none-match"] = remote.etag;
  const res = await fetch(url, { cache: "no-store", headers });
  if (res.status === 304 && cache) {
    remote = { at: Date.now(), etag: remote?.etag };
    return cache;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const snapshot = (await res.json()) as Snapshot;
  remote = { at: Date.now(), etag: res.headers.get("etag") ?? undefined };
  if (!cache || cache.key !== snapshot.generatedAt) cache = index(snapshot, snapshot.generatedAt);
  return cache;
}

/** Loads the snapshot: the remote URL, re-read at most every ten minutes, else data/snapshot.json (re-read when it changes). */
export async function getData(): Promise<Loaded> {
  if (URL) {
    if (cache && remote && Date.now() - remote.at < REVALIDATE_SECONDS * 1000) return cache;
    try {
      // one request at a time per instance, however many pages are waiting on it
      inflight ??= fromRemote(URL).finally(() => { inflight = null; });
      return await inflight;
    } catch (e) {
      // The remote snapshot is the fresher copy, not the only one. Before the scrape has ever run
      // the branch does not exist yet, and later it could be briefly unreachable; either way the
      // last copy read, or the schedule shipped with the build, is far better than an error page.
      if (cache && remote) {
        remote = { ...remote, at: Date.now() - (REVALIDATE_SECONDS - 60) * 1000 }; // try again in a minute
        return cache;
      }
      console.warn("snapshot fetch failed, falling back to the bundled copy:", e instanceof Error ? e.message : e);
    }
  }
  const st = await stat(FILE);
  const key = String(st.mtimeMs);
  if (cache && cache.key === key) return cache;
  cache = index(JSON.parse(await readFile(FILE, "utf8")) as Snapshot, key);
  return cache;
}
