/**
 * Poster proxy. Chains serve posters of wildly different reliability, and some (Lev) refuse
 * requests that carry a foreign Referer, so an <img> pointing straight at them shows nothing.
 * This route tries every candidate the scraper collected, sending each chain its own Referer,
 * and returns the first real image. One stable URL per film, cached hard at the edge.
 */
import { getData } from "@/lib/data";

export const revalidate = 86_400;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const TIMEOUT_MS = 5_000;
const MIN_BYTES = 900;

/** 2:3 placeholder, returned when nothing loads so the <img> never shows a broken icon. */
const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#e6e3dd"/><g fill="none" stroke="#b4ada1" stroke-width="6" stroke-linejoin="round"><rect x="62" y="112" width="76" height="60" rx="6"/><path d="M62 130h76M78 112v18M102 112v18M126 112v18"/></g></svg>`;

function placeholder(): Response {
  // Barely cached on purpose. A poster can be missing for a minute — the schedule has just been
  // republished and this film is newer than the copy this server holds, or the cinema's own image
  // host blinked — and an hour of cached emptiness turns that minute into an afternoon.
  return new Response(PLACEHOLDER, {
    headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=60, s-maxage=60" },
  });
}

/** Small in-process cache so one warm server does not refetch upstream for every visitor. */
const memo = new Map<string, { key: string; body: ArrayBuffer; type: string }>();
const MEMO_MAX = 300;
function remember(id: string, key: string, body: ArrayBuffer, type: string) {
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value!);
  memo.set(id, { key, body, type });
}

function image(body: ArrayBuffer, type: string): Response {
  return new Response(body, {
    headers: { "content-type": type, "cache-control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400" },
  });
}

async function tryFetch(url: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return null;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "image/avif,image/webp,image/*,*/*;q=0.8", referer: `${origin}/` },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < MIN_BYTES) return null; // 1x1 trackers and error stubs
    return { body: buf, type: type.split(";")[0] };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(_req: Request, ctx: RouteContext<"/api/poster/[id]">) {
  const { id } = await ctx.params;
  const data = await getData();
  const film = data.films.get(id);
  if (!film) return placeholder();

  const candidates = [...new Set([film.posterUrl, ...(film.posterUrls ?? [])].filter((u): u is string => !!u))];
  const cached = memo.get(id);
  if (cached && cached.key === candidates.join("|")) return image(cached.body, cached.type);

  for (const url of candidates) {
    const hit = await tryFetch(url);
    if (!hit) continue;
    remember(id, candidates.join("|"), hit.body, hit.type);
    return image(hit.body, hit.type);
  }
  return placeholder();
}
