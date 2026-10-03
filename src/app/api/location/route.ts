/**
 * Where the viewer is, written by the server.
 *
 * The same cookie written from the page's own JavaScript is treated as tracking leftovers by
 * Safari and thrown away within days, and an app added to the home screen keeps a cookie jar of
 * its own that starts empty every time. A cookie that arrives in a response header is neither of
 * those things, and it survives.
 */
import { LOC_COOKIE } from "@/lib/location";

/** A year. The viewer can change it any time; nothing else expires it. */
const MAX_AGE = 31_536_000;

export async function POST(req: Request) {
  let body: { lat?: unknown; lng?: unknown; label?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const lat = Number(body.lat), lng = Number(body.lng);
  const label = typeof body.label === "string" ? body.label.slice(0, 40) : "";
  // Israel and a wide margin around it; anything else is a mistake or a probe.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 28 || lat > 35 || lng < 32 || lng > 37) {
    return Response.json({ ok: false }, { status: 400 });
  }
  const value = `${lat.toFixed(5)},${lng.toFixed(5)},${encodeURIComponent(label)}`;
  // Secure would stop the cookie reaching a plain-http dev server on this machine.
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return Response.json(
    { ok: true },
    { headers: { "set-cookie": `${LOC_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}` } },
  );
}
