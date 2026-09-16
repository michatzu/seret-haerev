"use client";

import { track as vercelTrack } from "@vercel/analytics";

/**
 * What the site measures, and deliberately what it does not.
 *
 * Every event here describes the catalogue, not the visitor: which cinema a ticket link led to,
 * which film was saved, what somebody searched for. Nothing carries the viewer's location, their
 * chosen city, or the contents of their lists, because those describe a person rather than a page.
 * Vercel's analytics sets no cookies and identifies nobody, which is what lets the privacy page
 * keep saying the site does not know who you are.
 *
 * Outside production this is a no-op.
 */
export const track = {
  /** The action the whole site exists for: somebody went to buy a ticket. */
  booking(film: string, venue: string, hall: string) {
    vercelTrack("booking", { film, venue, hall });
  },
  /** Which films people mean to see, have seen, or want out of the way. */
  list(status: string, film: string) {
    vercelTrack("list", { status, film });
  },
  /** What people look for, which is the only way to learn what the catalogue is missing. */
  search(term: string) {
    const t = term.trim().slice(0, 40);
    if (t.length >= 2) vercelTrack("search", { term: t });
  },
  /** Which filters get used at all, so the sentence at the top can be trimmed if some never are. */
  filter(name: string, value: string) {
    vercelTrack("filter", { name, value: value.slice(0, 40) });
  },
};
