"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mark } from "./Mark";

/**
 * The name and the mark, which together are the way home.
 *
 * Pressing it from anywhere returns to the list and asks the server for it again, because the
 * thing somebody is usually after when they press the name of a site is the current state of it.
 */
export function SiteTitle() {
  const router = useRouter();
  return (
    <Link
      href="/"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        router.push("/");
        router.refresh();
      }}
      className="flex items-center gap-2"
    >
      <Mark />
      <span className="font-serif text-[26px] font-bold leading-none text-ink">סרט הערב</span>
    </Link>
  );
}
