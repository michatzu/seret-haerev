"use client";

import Link from "next/link";
import { ListIcon } from "./Icons";
import { idsWith, useFilmLists } from "@/lib/filmLists";

/**
 * Quick way into the viewer's lists, with a dot once something is saved to see. Deliberately not a
 * bookmark: that glyph already means "want to see" on every card, and the same icon twice reads as
 * the same action twice.
 */
export function ListsLink() {
  const { store, ready } = useFilmLists();
  const count = idsWith(store, "want").length;
  return (
    <Link href="/lists" aria-label={count ? `הרשימות שלי, ${count} סרטים ברשימת רוצה לראות` : "הרשימות שלי"} title="הרשימות שלי"
      className="relative flex h-11 w-11 items-center justify-center text-ink">
      <ListIcon width={20} height={20} />
      {ready && count > 0 && (
        <span aria-hidden className="absolute end-[9px] top-[9px] h-[7px] w-[7px] rounded-full bg-accent ring-2 ring-[var(--header-bg)]" />
      )}
    </Link>
  );
}
