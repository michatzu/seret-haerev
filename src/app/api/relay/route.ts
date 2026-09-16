/**
 * A relay for the handful of sources that answer GitHub's runners with 403 while answering
 * everybody else normally. The hourly refresh runs on GitHub; this route runs on Vercel, whose
 * addresses those sites do not block, so the scraper can ask it to make the request instead.
 *
 * It is not an open proxy: only the hosts this project already scrapes are allowed, only GET, and
 * the response is returned as text with no cookies or credentials of any kind passed through.
 */
const ALLOWED = new Set([
  "movieland.co.il",
  "www.movieland.co.il",
  "www.seret.co.il",
  "seret.co.il",
  "www.secrettelaviv.com",
  "secrettelaviv.com",
]);

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url");
  if (!target) return new Response("missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (parsed.protocol !== "https:" || !ALLOWED.has(parsed.hostname)) {
    return new Response("host not allowed", { status: 403 });
  }

  try {
    const res = await fetch(parsed, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "he-IL,he;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    const body = await res.arrayBuffer();
    return new Response(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return new Response(`relay failed: ${e instanceof Error ? e.message : e}`, { status: 502 });
  }
}
