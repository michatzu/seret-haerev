import { TZ, ymdInIsrael } from "./tz";

const timeFmt = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

const DAY_LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const wdFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const WD_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function weekdayIndex(iso: string | Date): number {
  return WD_INDEX[wdFmt.format(typeof iso === "string" ? new Date(iso) : iso)] ?? 0;
}
export function dayLetter(iso: string | Date): string {
  return DAY_LETTERS[weekdayIndex(iso)];
}
export function dayName(iso: string | Date): string {
  return DAY_NAMES[weekdayIndex(iso)];
}

/** True while the instant is close enough that a weekday name still identifies it on its own. */
export function withinTheWeek(iso: string | Date, now = Date.now()): boolean {
  const t = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  return t < now + 7 * 864e5;
}

/** "3.10", and for a run of days "3.10\u20137.10". Used once a weekday alone would be ambiguous. */
export function formatDateSet(isos: (string | Date)[]): string {
  const dates = [...new Set(isos.map((i) => ymdInIsrael(typeof i === "string" ? new Date(i) : i)))].sort();
  const label = (ymd: string) => {
    const [, m, d] = ymd.split("-").map(Number);
    return `${d}.${m}`;
  };
  if (!dates.length) return "";
  if (dates.length === 1) return label(dates[0]);
  const consecutive = dates.every((d, i) => i === 0 || Date.parse(d) - Date.parse(dates[i - 1]) === 864e5);
  if (consecutive && dates.length >= 3) return `${label(dates[0])}\u2013${label(dates[dates.length - 1])}`;
  if (dates.length === 2) return `${label(dates[0])}, ${label(dates[1])}`;
  return `${label(dates[0])} +${dates.length - 1}`;
}

/** A single screening's day: the weekday while that is unambiguous, otherwise the date. */
export function dayOrDate(iso: string | Date, now = Date.now()): string {
  return withinTheWeek(iso, now) ? dayName(iso) : formatDateSet([iso]);
}

/** Compact list of weekdays: [0,1,2,3,4] -> "א׳–ה׳", [0,2,6] -> "א׳ ג׳ ש׳", all seven -> "כל יום". */
export function formatDaySet(days: number[]): string {
  const u = [...new Set(days)].sort((a, b) => a - b);
  if (u.length === 7) return "כל יום";
  if (u.length === 1) return DAY_LETTERS[u[0]];
  const consecutive = u.every((d, i) => i === 0 || d === u[i - 1] + 1);
  if (consecutive && u.length >= 3) return `${DAY_LETTERS[u[0]]}–${DAY_LETTERS[u[u.length - 1]]}`;
  return u.map((d) => DAY_LETTERS[d]).join(" ");
}

const LANG_NAMES: Record<string, string> = {
  en: "אנגלית", he: "עברית", fr: "צרפתית", de: "גרמנית", it: "איטלקית", es: "ספרדית", ru: "רוסית", ar: "ערבית",
  ja: "יפנית", ko: "קוריאנית", zh: "סינית", pt: "פורטוגזית", sv: "שוודית", da: "דנית", no: "נורווגית", fi: "פינית",
  pl: "פולנית", tr: "טורקית", hi: "הינדי", nl: "הולנדית", el: "יוונית", cs: "צ׳כית", hu: "הונגרית", uk: "אוקראינית", fa: "פרסית", nn: "נורווגית", nb: "נורווגית", is: "איסלנדית", ka: "גאורגית", am: "אמהרית", ro: "רומנית", th: "תאית", yi: "יידיש", ca: "קטלאנית", sr: "סרבית", hr: "קרואטית", bg: "בולגרית",
};
/**
 * The language of a film, in Hebrew. The value can arrive either as an ISO code (from TMDB and the
 * chains) or already as a Hebrew word (the Haifa festival prints "102 \u05d3\u05e7\u05f3, \u05d9\u05d5\u05d5\u05e0\u05d9\u05ea" in its listing),
 * so both are accepted. Codes outside the table fall back to the browser's own language names.
 */
export function languageName(code?: string): string | undefined {
  const v = code?.trim();
  if (!v) return undefined;
  if (!/^[a-z]{2,3}(-[a-z]+)?$/i.test(v)) return v; // already a name
  const key = v.toLowerCase().split("-")[0];
  if (LANG_NAMES[key]) return LANG_NAMES[key];
  try {
    const name = new Intl.DisplayNames(["he"], { type: "language" }).of(key);
    return name && name.toLowerCase() !== key ? name : undefined;
  } catch {
    return undefined;
  }
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}

/** Hebrew counts: "בית קולנוע אחד" for one, "3 בתי קולנוע" for the rest. */
export const venuesCount = (n: number) => (n === 1 ? "בית קולנוע אחד" : `${n} בתי קולנוע`);
export const screeningsCount = (n: number) => (n === 1 ? "הקרנה אחת" : `${n} הקרנות`);
