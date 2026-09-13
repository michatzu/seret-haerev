import { TZ } from "./tz";

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
  pl: "פולנית", tr: "טורקית", hi: "הינדי", nl: "הולנדית", el: "יוונית", cs: "צ׳כית", hu: "הונגרית", uk: "אוקראינית", fa: "פרסית",
};
export function languageName(code?: string): string | undefined {
  return code ? LANG_NAMES[code] ?? undefined : undefined;
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}
