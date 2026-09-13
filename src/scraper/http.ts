const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

export async function getText(url: string, init: RequestInit = {}, timeoutMs = 25_000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "user-agent": UA, "accept-language": "he-IL,he;q=0.9,en;q=0.8", ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const text = await getText(url, { ...init, headers: { accept: "application/json, text/plain, */*", ...(init.headers ?? {}) } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 120)}`);
  }
}

/** Run tasks with limited concurrency, keeping order. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i], i) };
      } catch (e) {
        results[i] = { status: "rejected", reason: e };
      }
    }
  });
  await Promise.all(workers);
  return results;
}
