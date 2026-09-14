"use client";

import { useWatched } from "@/lib/watched";

/**
 * Hides watched films from the list. Done with one stylesheet rather than a client component per
 * card, so the server-rendered list stays server-rendered and nothing re-renders on toggle.
 */
export function WatchedStyles() {
  const { ids } = useWatched();
  if (!ids.length) return null;
  const css = ids.map((id) => `[data-film="${CSS.escape(id)}"]`).join(",") + "{display:none}";
  return <style>{css}</style>;
}
