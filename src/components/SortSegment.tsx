"use client";

import { usePathname, useRouter } from "next/navigation";
import { isMultiDay, SORT_LABELS, queryToSearch, type Query, type SortKey } from "@/lib/query";

export function SortSegment({ q }: { q: Query }) {
  const router = useRouter();
  const pathname = usePathname();
  const options: SortKey[] = isMultiDay(q.day) ? ["dist", "imdb"] : ["dist", "time", "imdb"];
  return (
    <div className="grid gap-1 rounded-xl bg-seg-bg p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="tablist" aria-label="מיון">
      {options.map((s) => {
        const on = q.sort === s;
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => router.replace(`${pathname}${queryToSearch({ ...q, sort: s })}`, { scroll: false })}
            className={`h-10 rounded-[9px] text-[13px] ${on ? "bg-seg-active font-semibold text-ink shadow-[var(--seg-shadow)]" : "font-medium text-muted"}`}
          >
            {SORT_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
