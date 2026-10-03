import "server-only";

/**
 * A key-value store, over its REST interface and nothing else.
 *
 * Both Vercel's own KV and the Upstash integration behind it hand the project the same two
 * variables, and both answer plain HTTP — so there is no client library here, and no sync code
 * feature at all until somebody provisions a store.
 */
const URL_ = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

export const kvReady = () => !!(URL_ && TOKEN);

async function command<T>(parts: (string | number)[]): Promise<T> {
  if (!URL_ || !TOKEN) throw new Error("no key-value store configured");
  const res = await fetch(URL_, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(parts),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`kv HTTP ${res.status}`);
  const body = (await res.json()) as { result?: T; error?: string };
  if (body.error) throw new Error(body.error);
  return body.result as T;
}

export const kvGet = (key: string) => command<string | null>(["GET", key]);
/** Written with an expiry, so a code nobody has touched for two years is not kept for ever. */
export const kvSet = (key: string, value: string, seconds = 63_072_000) => command<string>(["SET", key, value, "EX", seconds]);
export const kvSetIfAbsent = (key: string, value: string) => command<number>(["SETNX", key, value]);
export const kvDelete = (key: string) => command<number>(["DEL", key]);
