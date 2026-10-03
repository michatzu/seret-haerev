"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Close, FilmStack } from "./Icons";
import { queryToSearch, type Query } from "@/lib/query";
import { track } from "@/lib/track";

const DEBOUNCE_MS = 250;

/**
 * One box over everything the viewer might name: a film, a director, an actor, a genre, a hall
 * type, a cinema. The text lives in the URL like every other filter, so a search survives opening
 * a film and coming back and can be shared; typing is debounced so a search costs one request
 * rather than one per letter.
 */
export function SearchBox({ q }: { q: Query }) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(q.q);
  const applied = useRef(q.q);

  // the URL is the source of truth: a back button or a cleared filter must win over local state
  useEffect(() => {
    if (q.q !== applied.current) {
      applied.current = q.q;
      setText(q.q);
    }
  }, [q.q]);

  useEffect(() => {
    if (text === applied.current) return;
    const id = window.setTimeout(() => {
      applied.current = text;
      track.search(text);
      router.replace(`${pathname}${queryToSearch({ ...q, q: text, kids: false, small: false, far: false })}`, { scroll: false });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [text, q, pathname, router]);

  return (
    <div className="relative flex items-center">
      {/* The symbol sits at the head of the field rather than beside a centred word: a box with
          something written in the middle of it reads as a button, and this is a place to type.
          "סרצ׳" is "search" said aloud, and it reads as "סרט". */}
      <FilmStack width={17} height={17} aria-hidden className="pointer-events-none absolute start-3.5 text-muted" />
      {!text && (
        <span aria-hidden className="pointer-events-none absolute start-9 text-[15px] text-muted">סרצ׳..</span>
      )}
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="חיפוש סרטים, שחקנים, במאים, ז׳אנרים, אולמות ובתי קולנוע"
        className="h-11 w-full rounded-xl border border-line bg-card ps-9 pe-10 text-start text-[15px] text-ink outline-none focus:border-accent [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button type="button" onClick={() => setText("")} aria-label="ניקוי החיפוש"
          className="absolute end-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted">
          <Close width={16} height={16} />
        </button>
      )}
    </div>
  );
}
