"use client";

import Link from "next/link";
import { Bookmark } from "./Icons";
import { idsWith, useFilmLists } from "@/lib/filmLists";

/** Quick way into the viewer's lists, with a dot once something is saved to see. */
export function ListsLink() {
  const { store, ready } = useFilmLists();
  const count = idsWith(store, "want").length;
  return (
    <Link href="/lists" aria-label={count ? `הרשימות שלי, ${count} סרטים ברשימת רוצה לראות` : "הרשימות שלי"} title="הרשימות שלי"
      className="relative flex h-11 w-11 items-center justify-center text-ink">
      <Bookmark width={20} height={20} />
      {ready && count > 0 && (
        <span aria-hidden className="absolute end-[9px] top-[9px] h-[7px] w-[7px] rounded-full bg-accent ring-2 ring-[var(--header-bg)]" />
      )}
    </Link>
  );
}
