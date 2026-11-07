import "server-only";
import type { getData } from "./data";

type Loaded = Awaited<ReturnType<typeof getData>>;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const TIMEOUT_MS = 5_000;
const MIN_BYTES = 900;

/** Every poster address the scraper collected for a film, best first; for a film that left every cinema, the one kept with its name. */
export function posterCandidates(data: Loaded, id: string): string[] {
  const film = data.films.get(id);
  const urls = film ? [film.posterUrl, ...(film.posterUrls ?? [])] : [data.snapshot.retired?.[id]?.poster];
  return [...new Set(urls.filter((u): u is string => !!u))];
}

/**
 * One poster, or null. Some chains (Lev) refuse requests that carry a foreign Referer, so each is
 * sent its own; 1x1 trackers and error stubs come back too small to be a poster and are refused.
 * `accept` narrows the formats taken, for a renderer that can't read them all.
 */
export async function fetchPoster(url: string, accept = "image/avif,image/webp,image/*,*/*;q=0.8"): Promise<{ body: ArrayBuffer; type: string } | null> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return null;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": UA, accept, referer: `${origin}/` } });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < MIN_BYTES) return null;
    return { body: buf, type: type.split(";")[0] };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
