/** Israel time helpers, no dependencies. */
export const TZ = "Asia/Jerusalem";

const offsetFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" });

/** Offset (minutes east of UTC) of Asia/Jerusalem at a given instant. */
export function offsetMinutesAt(instant: Date): number {
  const part = offsetFmt.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Wall-clock time in Israel -> ISO string with the correct offset. Month is 1-based. */
export function zonedToIso(y: number, mo: number, d: number, hh: number, mm: number): string {
  const guess = Date.UTC(y, mo - 1, d, hh, mm);
  let off = offsetMinutesAt(new Date(guess));
  const utc = guess - off * 60_000;
  off = offsetMinutesAt(new Date(utc)); // re-check across a DST boundary
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  return `${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Parse "2026-09-13T18:15:00" (local wall time, no offset) into an Israel ISO string. */
export function localIsoToIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(local);
  if (!m) throw new Error(`bad local datetime: ${local}`);
  return zonedToIso(+m[1], +m[2], +m[3], +m[4], +m[5]);
}

/** Parse "12/10/2026 17:30" (dd/MM/yyyy HH:mm). */
export function dmyToIso(s: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/.exec(s.trim());
  if (!m) throw new Error(`bad dd/MM/yyyy datetime: ${s}`);
  return zonedToIso(+m[3], +m[2], +m[1], +m[4], +m[5]);
}

const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar date (YYYY-MM-DD) in Israel for an instant. */
export function ymdInIsrael(instant: Date = new Date()): string {
  return ymdFmt.format(instant); // en-CA gives YYYY-MM-DD
}

/** YYYY-MM-DD for today + n days (Israel calendar). */
export function ymdPlusDays(n: number, from: Date = new Date()): string {
  const base = ymdInIsrael(from);
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
