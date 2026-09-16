"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Close, Search } from "./Icons";
import { queryToSearch, type Query } from "@/lib/query";

const DEBOUNCE_MS = 250;

/**
 * Free text over titles, directors and cast. The text lives in the URL like every other filter, so
 * a search can be shared and survives going into a film and back; typing is debounced so a search
 * costs one request rather than one per letter.
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
      <Search width={17} height={17} className="pointer-events-none absolute start-3 text-muted" />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="חיפוש סרטים, שחקנים ובמאים"
        aria-label="חיפוש סרטים, שחקנים ובמאים"
        className="h-11 w-full rounded-xl border border-line bg-card ps-10 pe-10 text-[15px] text-ink outline-none placeholder:text-muted focus:border-accent [&::-webkit-search-cancel-button]:hidden"
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
