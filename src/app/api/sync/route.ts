/**
 * Lists, kept under a code instead of an account.
 *
 * What is stored is what the browser already holds: which films are in which list, their names,
 * and when they were filed. No address, no name, nothing that says who anybody is — the code is
 * the whole of the identity, and whoever has it has the list. That is the trade, and the page
 * that offers it says so.
 */
import { kvGet, kvReady, kvSet, kvSetIfAbsent } from "@/lib/kv";
import { normalizeCode } from "@/lib/syncCode";

/** A list of a few hundred films is a few tens of kilobytes; well past that is not a list. */
const MAX_BYTES = 256 * 1024;
const key = (code: string) => `sync:${code}`;

export async function GET(req: Request) {
  if (!kvReady()) return Response.json({ error: "unavailable" }, { status: 503 });
  const code = normalizeCode(new URL(req.url).searchParams.get("code") ?? "");
  if (!code) return Response.json({ error: "bad-code" }, { status: 400 });
  const raw = await kvGet(key(code)).catch(() => null);
  if (!raw) return Response.json({ error: "not-found" }, { status: 404 });
  return new Response(raw, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!kvReady()) return Response.json({ error: "unavailable" }, { status: 503 });
  const body = await req.text();
  if (body.length > MAX_BYTES) return Response.json({ error: "too-big" }, { status: 413 });
  let parsed: { code?: unknown; films?: unknown; claim?: unknown };
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    return Response.json({ error: "bad-json" }, { status: 400 });
  }
  if (!parsed.films || typeof parsed.films !== "object" || Array.isArray(parsed.films)) {
    return Response.json({ error: "bad-films" }, { status: 400 });
  }
  const code = typeof parsed.code === "string" ? normalizeCode(parsed.code) : null;
  if (!code) return Response.json({ error: "bad-code" }, { status: 400 });
  const payload = JSON.stringify({ films: parsed.films, at: new Date().toISOString() });

  // Claiming a code for the first time must not land on one somebody else is already keeping a
  // list under, so it is only written if nothing is there. Afterwards the browser that holds it
  // simply keeps it up to date.
  if (parsed.claim === true) {
    if ((await kvSetIfAbsent(key(code), payload)) !== 1) {
      return Response.json({ error: "taken" }, { status: 409 });
    }
    await kvSet(key(code), payload);
    return Response.json({ code });
  }
  await kvSet(key(code), payload);
  return Response.json({ code });
}
