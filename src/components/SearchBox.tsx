"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Close } from "./Icons";
import { queryToSearch, type Query } from "@/lib/query";

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
      router.replace(`${pathname}${queryToSearch({ ...q, q: text, kids: false, small: false, far: false })}`, { scroll: false });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [text, q, pathname, router]);

  return (
    <div className="relative flex items-center">
      {/* the placeholder is drawn here rather than by the input, so the clapperboard can sit beside
          it and the pair can be centred together */}
      {!text && (
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-[15px] text-muted">
          <span className="text-[17px] leading-none">🎬</span>
          <span>אקשן</span>
        </span>
      )}
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="חיפוש סרטים, שחקנים, במאים, ז׳אנרים, אולמות ובתי קולנוע"
        className="h-11 w-full rounded-xl border border-line bg-card px-10 text-center text-[15px] text-ink outline-none focus:border-accent [&::-webkit-search-cancel-button]:hidden"
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
