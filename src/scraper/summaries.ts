/**
 * The one line a card shows, and a repair for the synopses that need one.
 *
 * The rule here is to leave well alone. A synopsis that reads like a synopsis is kept exactly as
 * the cinema wrote it — the model is never shown it as something to improve, only as something to
 * say in one sentence. It is asked to rewrite only the texts that are not synopses at all: the
 * ones that open with the word "תקציר", that describe the evening rather than the film ("לאחר
 * ההקרנה תתקיים שיחה עם הבמאים"), or that are a list of the director's other work.
 *
 * Every answer is cached against the text it was given, so the same film is never paid for twice,
 * and a run without ANTHROPIC_API_KEY simply does none of this.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Film } from "@/lib/types";
import { pool } from "./http";

const CACHE_FILE = path.join(process.cwd(), "data", "summary-cache.json");
const MODEL = "claude-haiku-4-5-20251001";
const API = "https://api.anthropic.com/v1/messages";

/** Bumped when the instructions below change, so old answers are asked again. */
const PROMPT_VERSION = 1;

interface Cached { v: number; short?: string; full?: string; drop?: boolean }
type Cache = Record<string, Cached>;

const SYSTEM = `אתה עורך תוכן של אתר ישראלי שמרכז את לוח ההקרנות בבתי הקולנוע.

אתה מקבל שם של סרט ואת הטקסט שבית הקולנוע פרסם עליו. עליך להחזיר JSON בלבד, בלי שום טקסט נוסף, במבנה:
{"short": "משפט אחד", "full": "טקסט מתוקן או null", "drop": false}

"short": משפט אחד בעברית, עד 140 תווים, שאומר על מה הסרט. בלי ספוילרים, בלי "סרט על", בלי שמות שחקנים אלא אם הם עיקר העניין, ובלי סימן קריאה. לשון ניטרלית מבחינה מגדרית.
"full": כמעט תמיד null. מלא אותו רק אם הטקסט שקיבלת אינו תקציר תקין — למשל נפתח במילה "תקציר", מתאר את האירוע ולא את הסרט, או מכיל פילמוגרפיה או פרטי כרטיסים. במקרה כזה החזר את החלק שבאמת מתאר את הסרט, מילה במילה כפי שנכתב, בלי להוסיף ובלי לנסח מחדש.
"drop": true רק אם בטקסט כולו אין שום תיאור של הסרט עצמו.

אל תמציא עלילה. אם הטקסט לא מספיק כדי לכתוב "short", החזר "short": null.`;

async function loadCache(): Promise<Cache> {
  try { return JSON.parse(await readFile(CACHE_FILE, "utf8")); } catch { return {}; }
}
async function saveCache(c: Cache) {
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(c));
}

/** The same film with the same text must not be asked twice, so the text is part of the key. */
function cacheKey(film: Film, text: string): string {
  let h = 5381;
  const s = `${PROMPT_VERSION}|${film.title}|${text}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${film.id}:${(h >>> 0).toString(36)}`;
}

interface Answer { short?: string | null; full?: string | null; drop?: boolean }

async function ask(key: string, film: Film, text: string): Promise<Answer | null> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: "user", content: `שם הסרט: ${film.title}\n${film.year ? `שנה: ${film.year}\n` : ""}\nהטקסט שפורסם:\n${text.slice(0, 4000)}` }],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  const raw = body.content?.find((c) => c.type === "text")?.text ?? "";
  const json = /\{[\s\S]*\}/.exec(raw)?.[0];
  if (!json) return null;
  try { return JSON.parse(json) as Answer; } catch { return null; }
}

const clean = (s: unknown): string | undefined => {
  const t = typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
  return t && t !== "null" ? t : undefined;
};

/** Does this text look like somebody describing a film, rather than an evening or a career? */
const NEEDS_REPAIR = /^\s*(תקציר|סינופסיס|על הסרט)\b|לאחר ההקרנה|לפני ההקרנה|תתקיים שיחה|הכניסה חופשית|פילמוגרפיה|למוגרפיה|רכישת כרטיסים/;

/**
 * The card line without asking anybody: the opening sentence of the synopsis.
 *
 * It is not a summary — it is the beginning of one — but a synopsis almost always opens by saying
 * who the film is about, which is the thing somebody scrolling wants to know. Good enough to be
 * worth having on its own, and the model's sentence simply replaces it where there is a key.
 */
export function firstSentence(text: string, limit = 150): string | undefined {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 30) return undefined;
  const end = /[.!?]\s/.exec(t.slice(0, limit + 40));
  const cut = end ? t.slice(0, end.index + 1) : t.slice(0, limit).replace(/\s+\S*$/, "") + "…";
  return cut.length >= 30 ? cut : undefined;
}

export async function addSummaries(films: Film[]): Promise<{ asked: number; repaired: number; dropped: number; skipped: boolean }> {
  // Every film that has a synopsis gets a card line from its own first sentence, key or no key.
  for (const f of films) {
    if (!f.isEvent && f.synopsis) f.shortSynopsis = firstSentence(f.synopsis);
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { asked: 0, repaired: 0, dropped: 0, skipped: true };
  const cache = await loadCache();
  let asked = 0, repaired = 0, dropped = 0;

  const todo = films.filter((f) => !f.isEvent && (f.synopsis?.length ?? 0) > 40);
  await pool(todo, 4, async (film) => {
    const text = film.synopsis!;
    const ck = cacheKey(film, text);
    let hit = cache[ck];
    if (!hit) {
      let answer: Answer | null = null;
      try { answer = await ask(key, film, text); asked++; } catch (e) {
        console.warn(`summary: ${film.title}: ${e instanceof Error ? e.message : e}`);
        return; // leave the film exactly as it was
      }
      hit = cache[ck] = {
        v: PROMPT_VERSION,
        short: clean(answer?.short),
        // a "repair" that threw most of the text away, or grew it, is not a repair
        full: NEEDS_REPAIR.test(text) ? keepIfPlausible(clean(answer?.full), text) : undefined,
        drop: answer?.drop === true || undefined,
      };
    }
    if (hit.drop) { film.synopsis = undefined; dropped++; return; }
    if (hit.full) { film.synopsis = hit.full; repaired++; }
    if (hit.short) film.shortSynopsis = hit.short;
  });

  await saveCache(cache);
  return { asked, repaired, dropped, skipped: false };
}

/** A repaired text is a slice of the original, so it may be shorter — but not a different text. */
function keepIfPlausible(repaired: string | undefined, original: string): string | undefined {
  if (!repaired) return undefined;
  if (repaired.length < 40 || repaired.length > original.length + 20) return undefined;
  return repaired;
}
