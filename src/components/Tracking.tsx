"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

/**
 * One delegated listener for every ticket link on the page. A click handler per pill would turn
 * the whole list into client components; this keeps it server-rendered and still reports the one
 * action the site exists for.
 */
export function Tracking() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("a[data-booking]") as HTMLAnchorElement | null;
      if (!el) return;
      track.booking(el.dataset.film ?? "", el.dataset.venue ?? "", el.dataset.hall ?? "");
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
