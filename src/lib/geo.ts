export interface LatLng { lat: number; lng: number }

const R = 6371;
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "300 מ׳" under 1 km, "1.2 ק״מ" under 10 km, "12 ק״מ" above. */
export function formatDistance(km: number): string {
  if (km < 0.95) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} מ׳`;
  if (km < 10) return `${km.toFixed(1).replace(/\.0$/, "")} ק״מ`;
  return `${Math.round(km)} ק״מ`;
}

export interface Place extends LatLng { label: string }

/** Cities offered in the location picker (centre points). */
export const CITIES: Place[] = [
  { label: "תל אביב", lat: 32.0753, lng: 34.7751 },
  { label: "ירושלים", lat: 31.7784, lng: 35.2066 },
  { label: "חיפה", lat: 32.794, lng: 34.9896 },
  { label: "ראשון לציון", lat: 31.9635, lng: 34.8016 },
  { label: "פתח תקווה", lat: 32.0871, lng: 34.8878 },
  { label: "רמת גן וגבעתיים", lat: 32.0776, lng: 34.8138 },
  { label: "הרצליה", lat: 32.1663, lng: 34.8433 },
  { label: "רעננה וכפר סבא", lat: 32.181, lng: 34.8925 },
  { label: "נתניה", lat: 32.3215, lng: 34.8532 },
  { label: "חולון ובת ים", lat: 32.0158, lng: 34.7745 },
  { label: "רחובות", lat: 31.8928, lng: 34.8113 },
  { label: "מודיעין", lat: 31.8969, lng: 35.0104 },
  { label: "אשדוד", lat: 31.8014, lng: 34.6435 },
  { label: "אשקלון", lat: 31.6688, lng: 34.5743 },
  { label: "באר שבע", lat: 31.2518, lng: 34.7913 },
  { label: "חדרה", lat: 32.4341, lng: 34.9197 },
  { label: "עפולה", lat: 32.6078, lng: 35.2897 },
  { label: "כרמיאל", lat: 32.9186, lng: 35.2952 },
  { label: "נהריה", lat: 33.0058, lng: 35.098 },
  { label: "קריות", lat: 32.8316, lng: 35.0778 },
  { label: "טבריה", lat: 32.7922, lng: 35.5312 },
  { label: "עמק הירדן וצמח", lat: 32.7045, lng: 35.5865 },
  { label: "בית שאן", lat: 32.4968, lng: 35.4997 },
  { label: "צפת", lat: 32.9646, lng: 35.4960 },
  { label: "ראש פינה", lat: 32.9687, lng: 35.5422 },
  { label: "קרית שמונה", lat: 33.2074, lng: 35.5695 },
  { label: "קצרין", lat: 32.9908, lng: 35.6903 },
];

export const DEFAULT_PLACE: Place = CITIES[0];

/**
 * The label a position from the device is stored under. It is never shown as such once the page
 * has been closed: by the next visit it is only where the viewer was, so it is shown by its area.
 */
export const PRECISE_LABEL = "המיקום שלי";

/**
 * Named areas for describing a remembered position in a word or two. The picker's cities, with
 * Tel Aviv split the way people talk about it, and Holon and Bat Yam apart. Matched by the nearest
 * centre, which is rough at the edges and plenty for a label.
 */
const AREAS: Place[] = [
  { label: "צפון תל אביב", lat: 32.103, lng: 34.795 },
  { label: "מרכז תל אביב", lat: 32.074, lng: 34.778 },
  { label: "דרום תל אביב", lat: 32.053, lng: 34.777 },
  { label: "יפו", lat: 32.046, lng: 34.756 },
  { label: "בת ים", lat: 32.018, lng: 34.747 },
  { label: "חולון", lat: 32.015, lng: 34.786 },
  ...CITIES.filter((c) => c.label !== "תל אביב" && c.label !== "חולון ובת ים"),
];
const NEAR_KM = 8;

/** "דרום תל אביב", or "ליד כרמיאל" for somewhere between the named places. */
export function areaName(p: LatLng): string {
  let best = AREAS[0], bestD = Infinity;
  for (const a of AREAS) {
    const d = distanceKm(a, p);
    if (d < bestD) { best = a; bestD = d; }
  }
  return bestD <= NEAR_KM ? best.label : `ליד ${best.label}`;
}
