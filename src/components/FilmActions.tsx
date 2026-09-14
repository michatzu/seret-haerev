"use client";

import { Bookmark, BookmarkFilled, Check, Eye, EyeOff } from "./Icons";
import { setStatus, useFilmLists, type FilmStatus } from "@/lib/filmLists";

const ICONS: Record<FilmStatus, { off: typeof Eye; on: typeof Eye; label: string }> = {
  want: { off: Bookmark, on: BookmarkFilled, label: "רוצה לראות" },
  watched: { off: Eye, on: Check, label: "צפיתי" },
  skip: { off: EyeOff, on: EyeOff, label: "לא מעניין" },
};

/** The three list toggles. A film carries at most one status, so picking one clears the others. */
export function FilmActions({ filmId, title, size = "card" }: { filmId: string; title: string; size?: "card" | "page" }) {
  const { store, ready } = useFilmLists();
  const current = store[filmId];
  const box = size === "page" ? "h-11 w-11" : "h-8 w-8";
  const icon = size === "page" ? 20 : 17;

  return (
    <div className={`flex shrink-0 items-center ${size === "page" ? "gap-1" : "-me-1 -mt-1 gap-0"}`} style={{ opacity: ready ? 1 : 0 }}>
      {(["want", "watched", "skip"] as FilmStatus[]).map((s) => {
        const on = current === s;
        const Icon = on ? ICONS[s].on : ICONS[s].off;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            aria-label={`${ICONS[s].label}: ${title}`}
            title={ICONS[s].label}
            onClick={() => setStatus(filmId, s)}
            className={`flex ${box} touch-manipulation items-center justify-center rounded-lg ${on ? "text-accent" : "text-muted"}`}
          >
            <Icon width={icon} height={icon} />
          </button>
        );
      })}
    </div>
  );
}
