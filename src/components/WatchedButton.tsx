"use client";

import { toggleWatched, useWatched } from "@/lib/watched";
import { Check, Eye } from "./Icons";

/** Marks a film as seen, which removes it from the list and files it under /watched. */
export function WatchedButton({ filmId, title, variant = "card" }: { filmId: string; title: string; variant?: "card" | "page" }) {
  const { ids, ready } = useWatched();
  const on = ids.includes(filmId);

  const label = on ? `לסמן ש${title} לא נצפה` : `לסמן שצפיתי ב${title}`;
  if (variant === "page") {
    return (
      <button type="button" aria-label={label} aria-pressed={on} onClick={() => toggleWatched(filmId)}
        className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-[15px] font-medium ${on ? "border-accent bg-accent text-accent-ink" : "border-line bg-card text-ink"}`}>
        {on ? <Check width={18} height={18} /> : <Eye width={18} height={18} />}
        <span>{on ? "צפיתי" : "צפיתי"}</span>
      </button>
    );
  }
  return (
    <button type="button" aria-label={label} aria-pressed={on} onClick={() => toggleWatched(filmId)}
      className="flex min-h-[28px] shrink-0 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-muted"
      style={{ opacity: ready ? 1 : 0 }}>
      <Eye width={14} height={14} />
      <span>צפיתי</span>
    </button>
  );
}
