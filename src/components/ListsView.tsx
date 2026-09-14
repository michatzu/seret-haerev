"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronForward } from "./Icons";
import { Poster } from "./Poster";
import { clearList, idsWith, setStatus, STATUS_LABEL, STATUSES, useFilmLists, type FilmStatus } from "@/lib/filmLists";
import { languageName } from "@/lib/format";

interface Row { id: string; title: string; year?: number; language?: string; imdbRating?: number; hasPoster: boolean; screenings: number }

const EMPTY_TEXT: Record<FilmStatus, string> = {
  want: "כאן יישמרו הסרטים שסימנתם ״רוצה״. בנייד אפשר גם להחליק כרטיס ימינה.",
  watched: "כאן יישמרו הסרטים שכבר ראיתם, והם לא יופיעו שוב ברשימה.",
  skip: "כאן יישמרו הסרטים שסימנתם ״לא מעניין״. בנייד אפשר גם להחליק כרטיס שמאלה.",
};

export function ListsView() {
  const { store, ready } = useFilmLists();
  const [tab, setTab] = useState<FilmStatus>("want");
  const [cache, setCache] = useState<{ key: string; rows: Row[] } | null>(null);

  const ids = idsWith(store, tab);
  const key = `${tab}:${ids.join(",")}`;
  const loading = ready && ids.length > 0 && cache?.key !== key;

  useEffect(() => {
    const list = key.slice(key.indexOf(":") + 1); // the ids, straight from the key this effect runs on
    if (!ready || !list) return;
    const ctrl = new AbortController();
    fetch(`/api/films?ids=${encodeURIComponent(list)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { films: Row[] }) => setCache({ key, rows: d.films }))
      .catch(() => { /* offline or aborted; whatever is on screen stays */ });
    return () => ctrl.abort();
  }, [key, ready]);

  const marked = new Set(ids);
  const rows = (cache?.rows ?? []).filter((r) => marked.has(r.id));

  return (
    <>
      <header className="border-b border-line bg-header px-4 pb-0 pt-[max(18px,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-[520px]">
          <div className="flex items-center justify-between">
            <h1 className="font-serif text-[26px] font-bold leading-none text-ink">הרשימות שלי</h1>
            <Link href="/" className="flex h-11 items-center gap-1 text-[14px] font-medium text-accent">
              <span>כל הסרטים</span>
              <ChevronForward width={16} height={16} />
            </Link>
          </div>
          <div className="flex gap-1 pt-1" role="tablist">
            {STATUSES.map((s) => {
              const n = idsWith(store, s).length;
              const on = tab === s;
              return (
                <button key={s} role="tab" aria-selected={on} onClick={() => setTab(s)}
                  className={`flex min-h-[44px] items-center gap-1.5 border-b-2 px-2.5 text-[15px] ${on ? "border-accent font-semibold text-ink" : "border-transparent font-medium text-muted"}`}>
                  <span>{STATUS_LABEL[s]}</span>
                  {ready && n > 0 && <span className="text-[12px] text-muted">{n}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-2.5 px-4 pb-10 pt-3.5">
        {!ready || loading ? (
          <div className="px-1 py-8 text-center text-[15px] text-muted">טוען…</div>
        ) : !ids.length ? (
          <div className="rounded-xl border border-line bg-card px-4 py-8 text-center text-[15px] leading-[1.6] text-muted">{EMPTY_TEXT[tab]}</div>
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
                  {f.screenings > 0 ? <div className="text-[12px] text-muted">מוקרן עכשיו</div> : <div className="text-[12px] text-muted">ירד מהמסכים</div>}
                </div>
                <button type="button" onClick={() => setStatus(f.id, tab)} className="h-9 shrink-0 rounded-lg border border-line px-3 text-[13px] font-medium text-ink">
                  הסרה
                </button>
              </article>
            ))}
            <button type="button" onClick={() => { if (confirm(`לרוקן את הרשימה ״${STATUS_LABEL[tab]}״?`)) clearList(tab); }}
              className="mt-2 h-11 self-center px-4 text-[14px] font-medium text-muted">
              ריקון הרשימה
            </button>
            {ids.length > rows.length && !loading && (
              <p className="px-1 text-center text-[13px] text-muted">{ids.length - rows.length} סרטים ברשימה כבר אינם מוקרנים.</p>
            )}
          </>
        )}
      </main>
    </>
  );
}
