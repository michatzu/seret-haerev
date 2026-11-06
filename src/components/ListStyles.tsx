"use client";

import { idsWith, useFilmLists } from "@/lib/filmLists";

/**
 * Hides the films the viewer is done with (seen, or not interested) and marks the ones they want
 * to see, which stay in the list: the point of marking a film is finding it again among tonight's
 * times, not losing it. Done with one stylesheet rather than a client component per card, so the
 * server-rendered list stays server-rendered.
 */
export function ListStyles() {
  const { store } = useFilmLists();
  const hidden = [...idsWith(store, "watched"), ...idsWith(store, "skip")];
  const wanted = idsWith(store, "want");
  if (!hidden.length && !wanted.length) return null;
  const sel = (ids: string[], tail = "") => ids.map((id) => `[data-film="${CSS.escape(id)}"]${tail}`).join(",");
  const css = (hidden.length ? `${sel(hidden)}{display:none}` : "") + (wanted.length ? `${sel(wanted, " [data-card]")}{border-color:var(--color-accent)}` : "");
  return <style>{css}</style>;
}
