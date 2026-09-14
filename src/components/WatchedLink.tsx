"use client";

import Link from "next/link";
import { Eye } from "./Icons";
import { useWatched } from "@/lib/watched";

/** Quick way into the watched list, with a dot once there is something in it. */
export function WatchedLink() {
  const { ids, ready } = useWatched();
  return (
    <Link href="/watched" aria-label={ids.length ? `צפיתי, ${ids.length} סרטים` : "צפיתי"} title="צפיתי"
      className="relative flex h-11 w-11 items-center justify-center text-ink">
      <Eye width={20} height={20} />
      {ready && ids.length > 0 && (
        <span aria-hidden className="absolute end-[9px] top-[9px] h-[7px] w-[7px] rounded-full bg-accent ring-2 ring-[var(--header-bg)]" />
      )}
    </Link>
  );
}
