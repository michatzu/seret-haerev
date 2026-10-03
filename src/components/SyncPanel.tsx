"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { allEntries, mergeIn, useFilmLists } from "@/lib/filmLists";

/**
 * A code instead of an account.
 *
 * The lists live in this browser, which is private and costs nobody anything — and is also one
 * cleared cache away from gone, and no use at all on a second phone. So: a code. Whoever holds it
 * holds the list; there is no name and no password, and that is said plainly below rather than
 * buried in a privacy page.
 *
 * Once a code exists this keeps it up to date on its own, because a backup somebody has to
 * remember to press is a backup that is out of date on the day they need it.
 */
const CODE_KEY = "sync-code";
const CODE_EVENT = "sync-code-change";
const PUSH_DELAY_MS = 2500;

/** localStorage is a store outside React, read the way the film lists read theirs. */
const readCode = () => { try { return localStorage.getItem(CODE_KEY); } catch { return null; } };
function writeCode(code: string) {
  try { localStorage.setItem(CODE_KEY, code); } catch { /* nothing depends on it */ }
  window.dispatchEvent(new CustomEvent(CODE_EVENT));
}
function subscribeCode(onChange: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === CODE_KEY) onChange(); };
  window.addEventListener(CODE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(CODE_EVENT, onChange); window.removeEventListener("storage", onStorage); };
}
const useCode = () => useSyncExternalStore(subscribeCode, readCode, () => null);

export function SyncPanel() {
  const { store, ready } = useFilmLists();
  const code = useCode();
  const [state, setState] = useState<"idle" | "working" | "saved" | "error" | "not-found" | "off">("idle");
  const [entering, setEntering] = useState(false);
  const [typed, setTyped] = useState("");
  const pushed = useRef<string>("");

  const push = useCallback(async (withCode: string | null) => {
    const films = allEntries();
    const body = JSON.stringify({ code: withCode, films });
    const res = await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body });
    if (res.status === 503) { setState("off"); return null; }
    if (!res.ok) { setState("error"); return null; }
    const { code: got } = (await res.json()) as { code: string };
    pushed.current = JSON.stringify(films);
    writeCode(got);
    setState("saved");
    return got;
  }, []);

  // While a code exists, every change finds its way up a couple of seconds later.
  useEffect(() => {
    if (!ready || !code) return;
    const films = JSON.stringify(allEntries());
    if (films === pushed.current) return;
    const t = setTimeout(() => { void push(code); }, PUSH_DELAY_MS);
    return () => clearTimeout(t);
  }, [store, ready, code, push]);

  const create = async () => { setState("working"); await push(null); };

  const restore = async () => {
    setState("working");
    const res = await fetch(`/api/sync?code=${encodeURIComponent(typed)}`);
    if (res.status === 503) return setState("off");
    if (!res.ok) return setState("not-found");
    const { films } = (await res.json()) as { films: Record<string, unknown> };
    mergeIn(films as never);
    writeCode(typed.trim().replace(/\s+/g, "-"));
    setEntering(false);
    setState("saved");
  };

  if (state === "off") return null;

  return (
    <section className="mt-4 flex flex-col gap-2 rounded-xl border border-line bg-card px-4 py-3.5 text-[13px] leading-[1.6] text-muted">
      {code ? (
        <>
          <div>הרשימות שלך נשמרות גם אצלנו, תחת הקוד הזה:</div>
          <div dir="ltr" className="select-all rounded-lg bg-ph px-3 py-2 text-center font-mono text-[15px] font-medium tracking-wide text-ink">{code}</div>
          <div>כדי לראות אותן במכשיר אחר, או לשחזר אותן אם משהו נמחק — מקלידים שם את הקוד. שמור אותו במקום שתמצא.</div>
          {state === "working" && <div>שומר…</div>}
          {state === "error" && <div className="text-ink">לא הצלחנו לשמור כרגע. הרשימה בטוחה כאן בדפדפן, וננסה שוב בשינוי הבא.</div>}
        </>
      ) : entering ? (
        <>
          <label htmlFor="sync-code" className="font-medium text-ink">הקלדת קוד קיים</label>
          <input
            id="sync-code" dir="ltr" value={typed} onChange={(e) => setTyped(e.target.value)}
            placeholder="ירח-גשם-תפוז-418" autoComplete="off" autoCorrect="off" spellCheck={false}
            className="h-11 rounded-lg border border-line bg-ph px-3 text-center text-[15px] text-ink"
          />
          {state === "not-found" && <div className="text-ink">לא מצאנו קוד כזה. כדאי לבדוק שוב — שלוש מילים ושלוש ספרות.</div>}
          <div className="flex gap-2">
            <button type="button" onClick={restore} disabled={state === "working"} className="h-10 flex-1 rounded-lg border border-accent font-medium text-accent">
              {state === "working" ? "מאחזר…" : "שחזור"}
            </button>
            <button type="button" onClick={() => { setEntering(false); setState("idle"); }} className="h-10 flex-1 rounded-lg border border-line font-medium">ביטול</button>
          </div>
        </>
      ) : (
        <>
          <div className="font-medium text-ink">לא לאבד את הרשימות</div>
          <div>הרשימות נשמרות בדפדפן הזה בלבד. אפשר לקבל קוד שישמור אותן גם אצלנו — בלי שם, בלי סיסמה ובלי מייל — כדי לשחזר אותן או לראות אותן בטלפון אחר.</div>
          <div className="flex gap-2 pt-0.5">
            <button type="button" onClick={create} disabled={state === "working"} className="h-10 flex-1 rounded-lg border border-accent font-medium text-accent">
              {state === "working" ? "יוצר…" : "יצירת קוד"}
            </button>
            <button type="button" onClick={() => setEntering(true)} className="h-10 flex-1 rounded-lg border border-line font-medium">יש לי קוד</button>
          </div>
        </>
      )}
    </section>
  );
}
