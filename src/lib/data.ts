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
const REMOTE = process.env.SNAPSHOT_URL;
/** Needed only while the repository is private: raw.githubusercontent answers 404 without it. */
const TOKEN = process.env.SNAPSHOT_TOKEN;
/**
 * The same file through jsDelivr's CDN, asked only when GitHub doesn't answer. It is another network
 * with its own cache, so a GitHub outage, or a rate limit on a server address Vercel shares with
 * others, doesn't leave a new server instance with nothing but the schedule shipped with the build,
 * which is weeks old. Its copy of a branch can be up to about half a day behind. It reads public
 * repositories only: while the repository is private it simply fails. An empty value turns it off.
 */
const MIRROR = process.env.SNAPSHOT_MIRROR_URL ?? (REMOTE ? jsDelivr(REMOTE) : undefined);
const REVALIDATE_SECONDS = 600;
/** How soon to ask GitHub again after it failed. */
const RETRY_SECONDS = 60;
/**
 * How long a page waits for an answer. A full download takes under a second. With no copy yet, wait
 * long enough for a slow one; with a copy in hand, give up sooner, since a server that hangs would
 * otherwise hold up a visitor on every retry.
 */
const TIMEOUT_MS = 8000;
const TIMEOUT_WITH_COPY_MS = 3000;

/** raw.githubusercontent.com/<owner>/<repo>/<branch>/<path> → cdn.jsdelivr.net/gh/<owner>/<repo>@<branch>/<path> */
function jsDelivr(url: string): string | undefined {
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(url);
  return m ? `https://cdn.jsdelivr.net/gh/${m[1]}/${m[2]}@${m[3]}/${m[4]}` : undefined;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
let checked = 0; // when the copy in `cache` was last confirmed as current
const etags = new Map<string, string>(); // per URL, of the last copy read from it
let inflight: Promise<Loaded> | null = null;

/**
 * The snapshot at `url`, or null when it hasn't changed since it was last read from there; `cache`
 * then holds that copy or a newer one, since a copy is only ever replaced by a newer one.
 */
async function fetchSnapshot(url: string): Promise<Snapshot | null> {
  const headers: Record<string, string> = {};
  if (TOKEN && url === REMOTE) headers.authorization = `Bearer ${TOKEN}`; // never to the mirror
  const tag = etags.get(url);
  if (cache && tag) headers["if-none-match"] = tag;
  const signal = AbortSignal.timeout(cache ? TIMEOUT_WITH_COPY_MS : TIMEOUT_MS);
  const res = await fetch(url, { cache: "no-store", headers, signal });
  if (res.status === 304 && cache) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const snapshot = (await res.json()) as Snapshot;
  const etag = res.headers.get("etag");
  if (etag) etags.set(url, etag);
  return snapshot;
}

/**
 * GitHub's copy is the schedule, even when it goes back in time (a run reverted by hand). The
 * mirror's is only a stand-in, taken when it is newer than what this instance already has.
 */
function adopt(snapshot: Snapshot, fromMirror: boolean): Loaded {
  const newer = !cache || (fromMirror ? snapshot.generatedAt > cache.snapshot.generatedAt : cache.key !== snapshot.generatedAt);
  if (!cache || newer) cache = index(snapshot, snapshot.generatedAt);
  return cache;
}

/** Asks GitHub, and the mirror if GitHub fails. Throws GitHub's error when neither answers. */
async function refresh(): Promise<Loaded> {
  let failed: unknown;
  for (const url of [REMOTE, MIRROR]) {
    if (!url) continue;
    const fromMirror = url !== REMOTE;
    try {
      const snapshot = await fetchSnapshot(url);
      const loaded = snapshot ? adopt(snapshot, fromMirror) : (cache as Loaded);
      // on the mirror, GitHub gets asked again in a minute rather than in ten
      checked = fromMirror ? Date.now() - (REVALIDATE_SECONDS - RETRY_SECONDS) * 1000 : Date.now();
      if (fromMirror) console.warn(`snapshot: GitHub failed (${message(failed)}); asked the mirror, serving the copy of ${loaded.snapshot.generatedAt}`);
      return loaded;
    } catch (e) {
      failed ??= e;
    }
  }
  throw failed;
}

/** Loads the snapshot: the remote URL, re-read at most every ten minutes, else data/snapshot.json (re-read when it changes). */
export async function getData(): Promise<Loaded> {
  if (REMOTE) {
    if (cache && Date.now() - checked < REVALIDATE_SECONDS * 1000) return cache;
    try {
      // one request at a time per instance, however many pages are waiting on it
      inflight ??= refresh().finally(() => { inflight = null; });
      return await inflight;
    } catch (e) {
      // Neither answered. Before the scrape has ever run the branch does not exist yet, and later
      // both could be briefly unreachable. Ask again in a minute, and until then serve the last copy
      // read, or, before any was, the schedule shipped with the build: far better than an error page.
      checked = Date.now() - (REVALIDATE_SECONDS - RETRY_SECONDS) * 1000;
      if (cache) return cache;
      console.warn("snapshot fetch failed, falling back to the bundled copy:", message(e));
    }
  }
  const st = await stat(FILE);
  const key = String(st.mtimeMs);
  if (cache && cache.key === key) return cache;
  cache = index(JSON.parse(await readFile(FILE, "utf8")) as Snapshot, key);
  return cache;
}
