"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { allEntries, mergeIn, useFilmLists } from "@/lib/filmLists";

/**
 * A code instead of an account.
 *
 * The lists live in this browser, which is private and costs nobody anything — and is also one
 * cleared cache away from gone, and no use at all on a second phone. So: four digits, chosen by
 * the person keeping the list, because a number somebody picked is a number they remember.
 * Saving says so when those digits are already somebody else's; restoring adds to what is here
 * and never replaces it. Once a code is in hand this keeps it up to date on its own — a backup
 * you have to remember to press is out of date on the day you need it.
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
  const [state, setState] = useState<"idle" | "working" | "saved" | "error" | "taken" | "not-found" | "off">("idle");
  const [typed, setTyped] = useState("");
  const pushed = useRef<string>("");

  const send = useCallback(async (withCode: string, claim: boolean) => {
    const films = allEntries();
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: withCode, films, claim }),
    });
    if (res.status === 503) { setState("off"); return false; }
    if (res.status === 409) { setState("taken"); return false; }
    if (!res.ok) { setState("error"); return false; }
    pushed.current = JSON.stringify(films);
    writeCode(withCode);
    setState("saved");
    return true;
  }, []);

  // While a code is in hand, every change finds its way up a couple of seconds later.
  useEffect(() => {
    if (!ready || !code) return;
    const films = JSON.stringify(allEntries());
    if (films === pushed.current) return;
    const t = setTimeout(() => { void send(code, false); }, PUSH_DELAY_MS);
    return () => clearTimeout(t);
  }, [store, ready, code, send]);

  const digits = typed.replace(/\D/g, "").slice(0, 4);
  const complete = digits.length === 4;

  const save = async () => { setState("working"); await send(digits, true); };

  const restore = async () => {
    setState("working");
    const res = await fetch(`/api/sync?code=${encodeURIComponent(digits)}`);
    if (res.status === 503) return setState("off");
    if (!res.ok) return setState("not-found");
    const { films } = (await res.json()) as { films: Record<string, unknown> };
    mergeIn(films as never);
    pushed.current = JSON.stringify(allEntries());
    writeCode(digits);
    setState("saved");
  };

  if (state === "off") return null;

  const field = (
    <input
      inputMode="numeric" pattern="[0-9]*" maxLength={4} value={digits}
      onChange={(e) => { setTyped(e.target.value); if (state !== "working") setState("idle"); }}
      placeholder="0000" autoComplete="off" aria-label="קוד בן ארבע ספרות"
      className="h-11 w-full rounded-lg border border-line bg-ph text-center text-[20px] font-semibold tracking-[0.3em] text-ink outline-none focus:border-accent"
    />
  );

  return (
    <section className="mt-4 flex flex-col gap-2 rounded-xl border border-line bg-card px-4 py-3.5 text-[13px] leading-[1.6] text-muted">
      {code ? (
        <>
          <div className="font-medium text-ink">הרשימות שמורות תחת הקוד הזה:</div>
          <div className="select-all rounded-lg bg-ph px-3 py-2.5 text-center text-[22px] font-semibold tracking-[0.3em] text-ink">{code}</div>
          <div>מכאן זה קורה לבד — כל סרט שמסמנים נשמר גם אצלנו.</div>
          <div>כדאי לזכור את הקוד. בטלפון אחר, או אחרי שנמחקו נתוני האתר, נכנסים ל״הרשימות שלי״, מקלידים אותו ולוחצים ״שחזור״.</div>
          {state === "error" && <div className="text-ink">לא הצלחנו לשמור כרגע. הרשימות בטוחות כאן בדפדפן, וננסה שוב בשינוי הבא.</div>}
        </>
      ) : (
        <>
          <div className="font-medium text-ink">לא לאבד את הרשימות</div>
          <div>הן נשמרות רק בדפדפן הזה: ניקוי נתוני האתר מוחק אותן, ובטלפון אחר הן לא קיימות. אפשר לבחור קוד בן ארבע ספרות שישמור אותן גם אצלנו — בלי שם, בלי סיסמה ובלי מייל.</div>
          <div className="pt-1">{field}</div>
          {state === "taken" && <div className="text-ink">הקוד הזה כבר תפוס. אפשר לבחור ארבע ספרות אחרות — או, אם הוא שלך מטלפון אחר, ללחוץ ״שחזור״.</div>}
          {state === "not-found" && <div className="text-ink">אין רשימות שמורות תחת הקוד הזה.</div>}
          <div className="flex gap-2 pt-0.5">
            <button type="button" onClick={save} disabled={!complete || state === "working"} className="h-10 flex-1 rounded-lg border border-accent font-medium text-accent disabled:opacity-40">
              {state === "working" ? "רגע…" : "שמירה"}
            </button>
            <button type="button" onClick={restore} disabled={!complete || state === "working"} className="h-10 flex-1 rounded-lg border border-line font-medium disabled:opacity-40">
              שחזור
            </button>
          </div>
          <div>״שמירה״ בפעם הראשונה, כדי לשמור את מה שיש כאן. ״שחזור״ בטלפון אחר, או אחרי שמשהו נמחק.</div>
        </>
      )}
    </section>
  );
}
