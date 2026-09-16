"use client";

import { Bookmark, BookmarkFilled, Check, Eye, EyeOff } from "./Icons";
import { setStatus, useFilmLists, type FilmStatus } from "@/lib/filmLists";
import { track } from "@/lib/track";

/**
 * The three list buttons, in the order the hand expects them: "want" on the right, "watched" in the
 * middle, "not interested" on the left, which in a right-to-left page is this source order.
 * Quiet until touched: scrolling past a hundred cards should not feel like being asked a hundred
 * questions, so the resting state is a hairline outline and only the chosen one takes colour.
 */
const ACTIONS: { status: FilmStatus; label: string; off: typeof Eye; on: typeof Eye }[] = [
  { status: "want", label: "רוצה", off: Bookmark, on: BookmarkFilled },
  { status: "watched", label: "צפיתי", off: Eye, on: Check },
  { status: "skip", label: "לא מעניין", off: EyeOff, on: EyeOff },
];

export function FilmActions({ filmId, title, size = "card" }: { filmId: string; title: string; size?: "card" | "page" }) {
  const { store, ready } = useFilmLists();
  const current = store[filmId];
  const big = size === "page";

  return (
    <div className={`flex w-full items-stretch ${big ? "gap-2" : "gap-1.5"}`} style={{ opacity: ready ? 1 : 0.55 }}>
      {ACTIONS.map(({ status, label, off, on }) => {
        const active = current === status;
        const Icon = active ? on : off;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            aria-label={`${label}: ${title}`}
            onClick={() => { const now = setStatus(filmId, status, title); if (now) track.list(now, title); }}
            className={`flex min-w-0 flex-1 touch-manipulation items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border text-[12px] font-medium transition-colors ${
              big ? "h-11 text-[14px]" : "h-[34px]"
            } ${active ? "border-accent bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-accent" : "border-line text-muted"}`}
          >
            <Icon width={big ? 18 : 15} height={big ? 18 : 15} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
