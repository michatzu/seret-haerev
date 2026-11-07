/**
 * Poster proxy. Chains serve posters of wildly different reliability, and some (Lev) refuse
 * requests that carry a foreign Referer, so an <img> pointing straight at them shows nothing.
 * This route tries every candidate the scraper collected, sending each chain its own Referer,
 * and returns the first real image. One stable URL per film, cached hard at the edge.
 */
import { getData } from "@/lib/data";
import { fetchPoster, posterCandidates } from "@/lib/posterFetch";

export const revalidate = 86_400;

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

export async function GET(_req: Request, ctx: RouteContext<"/api/poster/[id]">) {
  const { id } = await ctx.params;
  const data = await getData();
  // A film can leave every cinema and stay in somebody's list; its poster is kept with its name.
  const candidates = posterCandidates(data, id);
  if (!candidates.length) return placeholder();
  const cached = memo.get(id);
  if (cached && cached.key === candidates.join("|")) return image(cached.body, cached.type);

  for (const url of candidates) {
    const hit = await fetchPoster(url);
    if (!hit) continue;
    remember(id, candidates.join("|"), hit.body, hit.type);
    return image(hit.body, hit.type);
  }
  /**
   * Nothing answered us — but "us" is a data centre, and Movieland's cinemas sit behind a wall
   * that lets a person through and stops a server. The viewer's own browser is a person's
   * browser, so hand it the address and let it try; it usually succeeds where this did not.
   */
  if (candidates[0]) {
    return Response.redirect(candidates[0], 307);
  }
  return placeholder();
}
