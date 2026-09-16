"use client";

import { useEffect, useState } from "react";
import { STATUS_LABEL, lastChange, undoLast, type FilmStatus } from "@/lib/filmLists";

const VISIBLE_MS = 6000;

/**
 * A card filed by mistake is easy to make and, without this, hard to find again: the film vanishes
 * and the viewer has to guess which of three lists swallowed it. One tap puts it back.
 */
export function UndoBar() {
  const [change, setChange] = useState<{ id: string; title: string; status: FilmStatus; at: number } | null>(null);

  useEffect(() => {
    const sync = () => {
      const c = lastChange();
      setChange(c && Date.now() - c.at < VISIBLE_MS ? c : null);
    };
    window.addEventListener("film-lists-change", sync);
    const timer = window.setInterval(sync, 1000);
    return () => {
      window.removeEventListener("film-lists-change", sync);
      window.clearInterval(timer);
    };
  }, []);

  if (!change) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+72px)]">
      <div className="pointer-events-auto flex max-w-[520px] items-center gap-3 rounded-xl bg-toast px-4 py-2.5 text-[14px] text-toast-ink shadow-[0_8px_24px_rgba(16,24,40,0.25)]">
        <span className="truncate">
          {change.title} · {STATUS_LABEL[change.status]}
        </span>
        <button type="button" onClick={() => { undoLast(); setChange(null); }} className="shrink-0 font-semibold text-toast-accent underline-offset-2">
          ביטול
        </button>
      </div>
    </div>
  );
}
