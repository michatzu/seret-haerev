import "server-only";
import { cookies, headers } from "next/headers";
import { CITIES, DEFAULT_PLACE, distanceKm, type Place } from "./geo";

export type PlaceSource = "cookie" | "ip" | "default";
export interface ResolvedPlace extends Place { source: PlaceSource }

export const LOC_COOKIE = "loc";

/** Location: explicit cookie (set by the location picker), else the IP's city, else Tel Aviv. */
export async function getPlace(): Promise<ResolvedPlace> {
  const c = (await cookies()).get(LOC_COOKIE)?.value;
  if (c) {
    const [lat, lng, ...rest] = c.split(",");
    const la = Number(lat), ln = Number(lng);
    if (Number.isFinite(la) && Number.isFinite(ln)) {
      const label = decodeURIComponent(rest.join(",") || "") || nearestCity({ lat: la, lng: ln }).label;
      return { lat: la, lng: ln, label, source: "cookie" };
    }
  }
  const h = await headers();
  const la = Number(h.get("x-vercel-ip-latitude"));
  const ln = Number(h.get("x-vercel-ip-longitude"));
  if (Number.isFinite(la) && Number.isFinite(ln) && la && ln) {
    const city = nearestCity({ lat: la, lng: ln });
    // use the city centre when the IP is roughly in a known city, else the raw point
    const near = distanceKm(city, { lat: la, lng: ln }) < 12;
    return near ? { ...city, source: "ip" } : { lat: la, lng: ln, label: city.label, source: "ip" };
  }
  return { ...DEFAULT_PLACE, source: "default" };
}

export function nearestCity(p: { lat: number; lng: number }): Place {
  let best = CITIES[0], bestD = Infinity;
  for (const c of CITIES) {
    const d = distanceKm(c, p);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}
