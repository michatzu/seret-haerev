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
];

export const DEFAULT_PLACE: Place = CITIES[0];
