/**
 * Address lookup for venues that arrive from a feed instead of the curated registry, so a
 * screening in a bar can still be placed on the map. Uses OpenStreetMap's Nominatim: free, no key,
 * and its usage policy asks for one request per second and a real User-Agent, both honoured here.
 * Every answer (including "not found") is cached on disk, so a venue is looked up once, ever.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const URL = "https://nominatim.openstreetmap.org/search";
const CACHE_FILE = path.join(process.cwd(), "data", "geocode-cache.json");
const UA = "seret-haerev/0.1 (+https://github.com/seret-haerev)";
const GAP_MS = 1_100;

/** Israel and the immediate surroundings; anything outside is a mis-geocode. */
const BOUNDS = { minLat: 29.4, maxLat: 33.4, minLng: 34.2, maxLng: 35.95 };

export interface GeoHit { lat: number; lng: number; label?: string }
type Cache = Record<string, GeoHit | null>;

let cache: Cache | null = null;
let dirty = false;
let lastCall = 0;

async function load(): Promise<Cache> {
  if (cache) return cache;
  try { cache = JSON.parse(await readFile(CACHE_FILE, "utf8")) as Cache; } catch { cache = {}; }
  return cache;
}

export async function saveGeocodeCache(): Promise<void> {
  if (!dirty || !cache) return;
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 0));
  dirty = false;
}

/**
 * Resolve a venue name (optionally with a city) to coordinates. Returns null when the place cannot
 * be found or lands outside Israel; callers should then skip the venue rather than guess.
 */
export async function geocode(name: string, city = "תל אביב"): Promise<GeoHit | null> {
  const query = `${name}, ${city}, ישראל`.replace(/\s+/g, " ").trim();
  const c = await load();
  if (query in c) return c[query];

  const wait = GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  let hit: GeoHit | null = null;
  try {
    const url = `${URL}?${new URLSearchParams({ q: query, format: "json", limit: "1", countrycodes: "il", "accept-language": "he" })}`;
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const rows = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[];
      const lat = Number(rows[0]?.lat), lng = Number(rows[0]?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng) {
        hit = { lat, lng, label: rows[0]?.display_name };
      }
    }
  } catch { /* cache the miss and move on */ }

  c[query] = hit;
  dirty = true;
  return hit;
}
