"use client";

import { idsWith, useFilmLists } from "@/lib/filmLists";

/**
 * Hides every film the viewer has filed away. Done with one stylesheet rather than a client
 * component per card, so the server-rendered list stays server-rendered.
 */
export function ListStyles() {
  const { store } = useFilmLists();
  const hidden = [...idsWith(store, "want"), ...idsWith(store, "watched"), ...idsWith(store, "skip")];
  if (!hidden.length) return null;
  return <style>{hidden.map((id) => `[data-film="${CSS.escape(id)}"]`).join(",") + "{display:none}"}</style>;
}
