"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronForward } from "./Icons";
import { Poster } from "./Poster";
import { clearWatched, toggleWatched, useWatched } from "@/lib/watched";
import { languageName } from "@/lib/format";

interface Row { id: string; title: string; year?: number; language?: string; imdbRating?: number; hasPoster: boolean; screenings: number }

export function WatchedList() {
  const { ids, ready } = useWatched();
  const [state, setState] = useState<{ key: string; rows: Row[] } | null>(null);
  const key = ids.join(",");
  const loading = ready && ids.length > 0 && state?.key !== key;

  useEffect(() => {
    if (!ready || !ids.length) return;
    const ctrl = new AbortController();
    fetch(`/api/films?ids=${encodeURIComponent(key)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { films: Row[] }) => setState({ key, rows: d.films }))
      .catch(() => { /* offline or aborted; whatever is on screen stays */ });
    return () => ctrl.abort();
  }, [key, ids.length, ready]);

  // keep the rows that are still marked, so removing one is instant
  const marked = new Set(ids);
  const rows = (state?.rows ?? []).filter((r) => marked.has(r.id));

  return (
    <>
      <header className="border-b border-line bg-header px-4 pb-3 pt-[max(18px,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-[520px] items-center justify-between">
          <h1 className="font-serif text-[26px] font-bold leading-none text-ink">צפיתי</h1>
          <Link href="/" className="flex h-11 items-center gap-1 text-[14px] font-medium text-accent">
            <span>לרשימה</span>
            <ChevronForward width={16} height={16} />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-2.5 px-4 pb-10 pt-3.5">
        {!ready || loading ? (
          <div className="px-1 py-8 text-center text-[15px] text-muted">רגע…</div>
        ) : !ids.length ? (
          <div className="rounded-xl border border-line bg-card px-4 py-8 text-center text-[15px] leading-[1.6] text-muted">
            עדיין לא סימנת סרטים.
            <br />
            סימון סרט כ״צפיתי״ מסיר אותו מהרשימה ושומר אותו כאן.
          </div>
        ) : (
          <>
            {rows.map((f) => (
              <article key={f.id} className="flex items-center gap-3 rounded-xl border border-line bg-card p-3.5">
                <Link href={`/film/${f.id}`} className="shrink-0" aria-label={f.title}>
                  <Poster filmId={f.id} hasPoster={f.hasPoster} alt="" width={44} height={66} />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <Link href={`/film/${f.id}`} className="truncate font-serif text-[17px] font-bold leading-[1.2] text-ink">{f.title}</Link>
                  <div className="text-[12px] text-muted">
                    {[languageName(f.language), f.year, f.imdbRating ? `IMDb ${f.imdbRating.toFixed(1)}` : undefined].filter(Boolean).join(" · ")}
                  </div>
                  {f.screenings > 0 && <div className="text-[12px] text-muted">עדיין מוקרן</div>}
                </div>
                <button type="button" onClick={() => toggleWatched(f.id)} className="h-9 shrink-0 rounded-lg border border-line px-3 text-[13px] font-medium text-ink">
                  החזרה
                </button>
              </article>
            ))}
            {rows.length > 0 && (
              <button type="button" onClick={() => { if (confirm("לרוקן את הרשימה?")) clearWatched(); }} className="mt-2 h-11 self-center px-4 text-[14px] font-medium text-muted">
                ריקון הרשימה
              </button>
            )}
            {ids.length > rows.length && !loading && (
              <p className="px-1 pt-2 text-center text-[13px] text-muted">{ids.length - rows.length} סרטים כבר אינם מוקרנים ולכן אינם מוצגים.</p>
            )}
          </>
        )}
      </main>
    </>
  );
}
