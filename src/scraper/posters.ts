/**
 * Fallbacks for chains whose feeds carry no image or synopsis: read the film's own page.
 * Lev: featured image from wp-content/uploads + og:description. Hot: poster file name from the
 * embedded movie JSON. Everything is cached on disk for two weeks.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Film } from "@/lib/types";
import { getText, pool } from "./http";

const CACHE_FILE = path.join(process.cwd(), "data", "poster-cache.json");
interface Hit { v?: number; url: string | null; synopsis?: string | null; at: string }
/** Bumped when parsing changes, so pages read under the old rules are read again. */
const PARSE_VERSION = 2;
type Cache = Record<string, Hit>;
const FRESH_MS = 14 * 86_400_000;

function pageUrl(chain: string, id: string, title: string): string | undefined {
  if (chain === "lev") return `https://www.lev.co.il/movies/${encodeURIComponent(id.replace(/\s+/g, "-"))}/`;
  // Jerusalem's calendar carries no images; each film's node page does
  if (chain === "cinematheque" && id.startsWith("jlm-node-")) return `https://jer-cin.org.il/he/node/${id.slice("jlm-node-".length)}`;
  // the Haifa festival's schedule carries no images either; its film pages do
  if (chain === "other" && id.startsWith("haifa-film-")) return `https://www.haifaff.co.il/%D7%A1%D7%A8%D7%98%D7%99%D7%9D/${id.slice("haifa-film-".length)}/x`;
  if (chain === "cinematheque" && id.startsWith("sderot-movie-")) return `https://www.sderot-cin.org.il/movie/${id.slice("sderot-movie-".length)}`;
  void title;
  return undefined;
}

/** Images the page uses as chrome rather than as the film's poster. */
const CHROME = /logo|icon|placeholder|banner|header|footer|sprite|avatar/i;

/** Where a page stops describing the film and starts selling tickets. */
const BOILERPLATE = /(\*\s*)?לקוחות יקרים|שימו לב\s*:|ברכישת כרטיסים|הכניסה לאולם|רכישת כרטיסים|למידע נוסף|מחיר כרטיס|הנחה למנויים|\d{2,3}\s*(דקות|דק׳|דק')\s*,|\bבהשתתפות\b.*\bבמאי\b/;

/**
 * A synopsis fit to print: the sales notice that follows it on most cinema pages is cut away, and
 * an over-long text ends at a sentence rather than in the middle of a word.
 */
function cleanSynopsis(raw: string | null | undefined, limit = 900): string | null {
  if (!raw) return null;
  let t = decode(raw.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  const stop = BOILERPLATE.exec(t);
  if (stop && stop.index > 60) t = t.slice(0, stop.index).trim();
  t = t.replace(/\s*\d{2,3}\s*(דקות|דק׳|דק')\s*[,.|].*$/, "").trim();
  t = t.replace(/\s*\|[^|]{0,80}(כתוביות|מגיל|תרגום|דיון|הנחיית)[^|]*$/, "").trim();
  t = t.replace(/[\s*·|,\-–—]+$/, "").trim();
  if (t.length <= limit) return t || null;
  const cut = t.slice(0, limit);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf("׃"));
  return (lastStop > limit * 0.5 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, "")).trim() + (lastStop > limit * 0.5 ? "" : "…");
}

/** The longest `description` in any JSON-LD block: sites truncate og:description, not this. */
function jsonLdDescription(html: string): string | null {
  let best: string | null = null;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const walk = (v: unknown) => {
      if (Array.isArray(v)) return v.forEach(walk);
      if (!v || typeof v !== "object") return;
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (k === "description" && typeof val === "string" && (!best || val.length > best.length)) best = val;
        else walk(val);
      }
    };
    walk(data);
  }
  return best;
}

const ogContent = (html: string, prop: string) =>
  new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']*)["']`, "i").exec(html)?.[1]
  ?? new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:${prop}["']`, "i").exec(html)?.[1];

function parse(chain: string, html: string): { url: string | null; synopsis: string | null } {
  if (chain === "lev") {
    // The first wp-content image on a Lev page is the site-wide header background, not the poster.
    // The page's own JSON-LD names the real one as #mainImage; fall back to og:image, then to a
    // file that calls itself a poster, then to any upload that is not used as a CSS background.
    const ld = /#mainImage"\s*,\s*"url"\s*:\s*"([^"]+)"/.exec(html)?.[1];
    const og = ogContent(html, "image");
    const backgrounds = new Set([...html.matchAll(/background[^;"']*:\s*url\(\s*['"]?([^)'"]+)/gi)].map((m) => m[1].trim()));
    const uploads = [...html.matchAll(/https:\/\/www\.lev\.co\.il\/wp-content\/uploads\/[^"'\s)]+\.(?:jpe?g|png|webp)/gi)]
      .map((m) => m[0])
      .filter((u) => !CHROME.test(u) && !backgrounds.has(u));
    const url = fromJsonString(ld) ?? fromJsonString(og) ?? uploads.find((u) => /poster/i.test(u)) ?? uploads[0] ?? null;
    // Lev truncates its own JSON-LD too; the whole text sits in .movie_content, under a "תקציר" heading
    const body = /class="[^"]*movie_content[^"]*"[^>]*>([\s\S]{0,4000}?)<\/div>/i.exec(html)?.[1];
    return { url, synopsis: cleanSynopsis(body?.replace(/^\s*תקציר\s*/, "")) ?? cleanSynopsis(jsonLdDescription(html)) ?? cleanSynopsis(ogContent(html, "description")) };
  }
  if (chain === "cinematheque" || chain === "other") {
    const og = ogContent(html, "image")
      // Sderot publishes no og:image; its film still is the one rendered at the "main_movie" size
      ?? /src="(\/sites\/default\/files\/styles\/main_movie\/[^"]+)"/i.exec(html)?.[1]?.replace(/^\//, "https://www.sderot-cin.org.il/").replace(/&amp;/g, "&");
    // the festival prints the whole synopsis in a div named after the film, and only a slice of it
    // in og:description
    const body = /class="[^"]*movie_desc_heb[^"]*"[^>]*>([\s\S]{0,4000}?)<\/div>/i.exec(html)?.[1];
    return {
      url: og && !CHROME.test(og) ? decode(og) : null,
      synopsis: cleanSynopsis(body) ?? cleanSynopsis(jsonLdDescription(html)) ?? cleanSynopsis(ogContent(html, "description")),
    };
  }
  return { url: null, synopsis: null };
}

/**
 * A URL lifted out of JSON-LD is still a JSON string: every slash is escaped, and a Hebrew file
 * name arrives one backslash-u escape per letter. Left as they are, those escapes travel into the
 * address the poster proxy asks for and the cinema answers 404 — so read the value as JSON means it.
 */
function fromJsonString(u: string | undefined): string | null {
  if (!u) return null;
  let clean: string;
  try {
    clean = decode(JSON.parse(`"${u}"`));
  } catch {
    clean = decode(u.replace(/\\\//g, "/"));
  }
  return /^https?:\/\//.test(clean) && !CHROME.test(clean) ? clean : null;
}

export async function fillPosters(films: Film[]): Promise<{ posters: number; synopses: number }> {
  let cache: Cache = {};
  try { cache = JSON.parse(await readFile(CACHE_FILE, "utf8")); } catch { /* first run */ }
  const todo = films.filter((f) => (!f.posterUrl || !f.synopsis) && !f.isEvent && f.sources.some((s) => pageUrl(s.chain, s.id, s.title)));
  let posters = 0, synopses = 0;
  await pool(todo, 4, async (film) => {
    for (const src of film.sources) {
      const url = pageUrl(src.chain, src.id, src.title);
      if (!url) continue;
      const ck = `${src.chain}:${src.id}`;
      let hit = cache[ck];
      if (!hit || hit.v !== PARSE_VERSION || Date.now() - new Date(hit.at).getTime() > FRESH_MS) {
        let parsed = { url: null as string | null, synopsis: null as string | null };
        try { parsed = parse(src.chain, await getText(url)); } catch { /* keep nulls */ }
        hit = cache[ck] = { v: PARSE_VERSION, ...parsed, at: new Date().toISOString() };
      }
      if (hit.url) {
        // keep every page poster as a fallback candidate, even once one is chosen
        film.posterUrls = [...new Set([...(film.posterUrls ?? []), hit.url])];
        if (!film.posterUrl) { film.posterUrl = hit.url; posters++; }
      }
      if (!film.synopsis && hit.synopsis) { film.synopsis = hit.synopsis; synopses++; }
      if (film.synopsis && (film.posterUrls?.length ?? 0) >= 2) break; // enough for a fallback
    }
  });
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache));
  return { posters, synopses };
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}
