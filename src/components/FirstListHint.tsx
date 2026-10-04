"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Close } from "./Icons";
import { useFilmLists } from "@/lib/filmLists";

/**
 * Said once, at the only moment it means anything.
 *
 * Filing the first film quietly creates a list on a page the viewer has not been to, kept in a
 * browser they have not thought about. By the time they find the panel offering to save it they
 * may have built the list twice, on two phones, and lost one. So it is said here, the moment the
 * first film is filed — low on the screen, out of the way of the scroll, and gone for good once
 * it is closed or acted on.
 */
const SEEN = "first-list-hint";
const EVENT = "first-list-hint-change";

const seen = () => { try { return localStorage.getItem(SEEN) === "1"; } catch { return true; } };
function markSeen() {
  try { localStorage.setItem(SEEN, "1"); } catch { /* nothing depends on it */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function FirstListHint() {
  const { store, ready } = useFilmLists();
  const alreadySeen = useSyncExternalStore(subscribe, seen, () => true);
  const [closed, setClosed] = useState(false);

  const filed = Object.keys(store).length;
  // the first film, and only the first: somebody with a list already knows they have one
  if (!ready || alreadySeen || closed || filed !== 1) return null;

  const close = () => { setClosed(true); markSeen(); };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+124px)]">
      <div className="pointer-events-auto flex w-full max-w-[520px] items-start gap-3 rounded-xl border border-line bg-toast px-4 py-3 text-[13px] leading-[1.55] text-toast-ink shadow-[0_8px_24px_rgba(16,24,40,0.35)]">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="font-semibold">הסרט נשמר ברשימה שלך</div>
          <div className="opacity-80">הרשימות נשמרות בדפדפן הזה בלבד. בעמוד ״הרשימות שלי״ אפשר לבחור קוד שישמור אותן, או להזין קוד קיים כדי לשחזר רשימה ממכשיר אחר.</div>
          <Link href="/lists" onClick={close} className="mt-0.5 self-start font-semibold text-toast-accent underline underline-offset-2">
            לרשימות שלי
          </Link>
        </div>
        <button type="button" onClick={close} aria-label="סגירה" className="-me-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-70">
          <Close width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
