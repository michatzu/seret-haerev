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
interface Hit { url: string | null; synopsis?: string | null; at: string }
type Cache = Record<string, Hit>;
const FRESH_MS = 14 * 86_400_000;

function pageUrl(chain: string, id: string, title: string): string | undefined {
  if (chain === "lev") return `https://www.lev.co.il/movies/${encodeURIComponent(id.replace(/\s+/g, "-"))}/`;
  // Jerusalem's calendar carries no images; each film's node page does
  if (chain === "cinematheque" && id.startsWith("jlm-node-")) return `https://jer-cin.org.il/he/node/${id.slice("jlm-node-".length)}`;
  void title;
  return undefined;
}

/** Images the page uses as chrome rather than as the film's poster. */
const CHROME = /logo|icon|placeholder|banner|header|footer|sprite|avatar/i;

function parse(chain: string, html: string): { url: string | null; synopsis: string | null } {
  if (chain === "lev") {
    // The first wp-content image on a Lev page is the site-wide header background, not the poster.
    // The page's own JSON-LD names the real one as #mainImage; fall back to og:image, then to a
    // file that calls itself a poster, then to any upload that is not used as a CSS background.
    const ld = /#mainImage"\s*,\s*"url"\s*:\s*"([^"]+)"/.exec(html)?.[1];
    const og = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1]
      ?? /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(html)?.[1];
    const backgrounds = new Set([...html.matchAll(/background[^;"']*:\s*url\(\s*['"]?([^)'"]+)/gi)].map((m) => m[1].trim()));
    const uploads = [...html.matchAll(/https:\/\/www\.lev\.co\.il\/wp-content\/uploads\/[^"'\s)]+\.(?:jpe?g|png|webp)/gi)]
      .map((m) => m[0])
      .filter((u) => !CHROME.test(u) && !backgrounds.has(u));
    const url = unescapeSlashes(ld) ?? unescapeSlashes(og) ?? uploads.find((u) => /poster/i.test(u)) ?? uploads[0] ?? null;
    const desc = /<meta\s+property="og:description"\s+content="([^"]*)"/i.exec(html)?.[1];
    return { url, synopsis: desc ? decode(desc) : null };
  }
  if (chain === "cinematheque") {
    const og = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
    const desc = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1];
    return { url: og && !CHROME.test(og) ? decode(og) : null, synopsis: desc ? decode(desc) : null };
  }
  return { url: null, synopsis: null };
}

/** JSON-LD escapes every slash: "https:\/\/www.lev.co.il\/..." */
function unescapeSlashes(u: string | undefined): string | null {
  if (!u) return null;
  const clean = decode(u.replace(/\\\//g, "/"));
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
      if (!hit || Date.now() - new Date(hit.at).getTime() > FRESH_MS) {
        let parsed = { url: null as string | null, synopsis: null as string | null };
        try { parsed = parse(src.chain, await getText(url)); } catch { /* keep nulls */ }
        hit = cache[ck] = { ...parsed, at: new Date().toISOString() };
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
