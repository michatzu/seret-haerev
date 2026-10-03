"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Close } from "./Icons";
import { Poster } from "./Poster";
import { SyncPanel } from "./SyncPanel";
import { SiteTitle } from "./SiteTitle";
import { clearList, entriesWith, idsWith, rememberTitles, setStatus, STATUS_LABEL, STATUSES, useFilmLists, type FilmStatus } from "@/lib/filmLists";
import { languageName } from "@/lib/format";

interface Row { id: string; title: string; year?: number; language?: string; imdbRating?: number; hasPoster: boolean; screenings: number }

const EMPTY_TEXT: Record<FilmStatus, string> = {
  want: "כאן יישמר כל סרט שסימנת כ״מעניין״. בנייד אפשר גם להחליק את הכרטיס ימינה.",
  watched: "כאן יישמרו הסרטים שסימנת שכבר ראית, והם לא יופיעו שוב ברשימה.",
  skip: "כאן יישמר כל סרט שסימנת כ״לא מעניין״. בנייד אפשר גם להחליק את הכרטיס שמאלה.",
};

export function ListsView() {
  const { store, ready } = useFilmLists();
  const [tab, setTab] = useState<FilmStatus>("want");
  const [cache, setCache] = useState<{ key: string; rows: Row[] } | null>(null);

  // A film filed before the site kept names, and long gone from every schedule, is a row that
  // says nothing: no name, no poster, no year. Better not to draw it than to draw "סרט".
  const entries = entriesWith(store, tab);
  const ids = entries.map((e) => e.id);
  const key = `${tab}:${ids.join(",")}`;

  useEffect(() => {
    const list = key.slice(key.indexOf(":") + 1); // the ids, straight from the key this effect runs on
    if (!ready || !list) return;
    const ctrl = new AbortController();
    fetch(`/api/films?ids=${encodeURIComponent(list)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { films: Row[] }) => { setCache({ key, rows: d.films }); rememberTitles(d.films); })
      .catch(() => { /* offline or aborted; whatever is on screen stays */ });
    return () => ctrl.abort();
  }, [key, ready]);

  // The list is whatever this browser filed; the schedule only adds to it what it still knows.
  const live = new Map((cache?.rows ?? []).map((r) => [r.id, r] as const));

  return (
    <>
      <header className="border-b border-line bg-header px-4 pb-0 pt-[max(18px,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-[520px]">
          <div className="flex min-h-[44px] items-center justify-between gap-2">
            <SiteTitle />
            <h1 className="text-[15px] font-medium text-muted">הרשימות שלי</h1>
          </div>
          <div className="flex justify-center gap-1 pt-1" role="tablist">
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
        {!ready ? (
          <div className="px-1 py-8 text-center text-[15px] text-muted">טוען…</div>
        ) : !entries.length ? (
          <div className="rounded-xl border border-line bg-card px-4 py-8 text-center text-[15px] leading-[1.6] text-muted">{EMPTY_TEXT[tab]}</div>
        ) : (
          <>
            {entries.map((e) => {
              const f = live.get(e.id);
              const title = f?.title || e.title;
              // nothing to show and nothing to call it: the schedule forgot it and so did we
              if (!title) return null;
              const year = f?.year ?? e.year;
              const showing = (f?.screenings ?? 0) > 0;
              const poster = <Poster filmId={e.id} hasPoster={!!f?.hasPoster} alt="" width={44} height={66} />;
              return (
                <article key={e.id} className="flex items-center gap-3 rounded-xl border border-line bg-card p-3.5">
                  {f ? <Link href={`/film/${e.id}`} className="shrink-0" aria-label={title}>{poster}</Link> : poster}
                  <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    {f
                      ? <Link href={`/film/${e.id}`} className="truncate font-serif text-[17px] font-bold leading-[1.2] text-ink">{title}</Link>
                      : <div className="truncate font-serif text-[17px] font-bold leading-[1.2] text-ink">{title}</div>}
                    <div className="text-[12px] text-muted">
                      {[languageName(f?.language), year, f?.imdbRating ? `IMDb ${f.imdbRating.toFixed(1)}` : undefined].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-[12px] text-muted">{showing ? "מוקרן עכשיו" : "ירד מהאקרנים"}</div>
                  </div>
                  <button type="button" onClick={() => setStatus(e.id, tab, title)} aria-label={`הוצאה מהרשימה: ${title}`} title="הוצאה מהרשימה"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted">
                    <Close width={17} height={17} />
                  </button>
                </article>
              );
            })}
            <button type="button" onClick={() => { if (confirm(`לרוקן את הרשימה ״${STATUS_LABEL[tab]}״?`)) clearList(tab); }}
              className="mt-2 h-11 self-center px-4 text-[14px] font-medium text-muted">
              ריקון הרשימה
            </button>
          </>
        )}
        {ready && <SyncPanel />}
      </main>
    </>
  );
}
