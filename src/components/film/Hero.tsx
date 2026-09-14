import Link from "next/link";
import { ChevronForward, Film as FilmIcon, Play } from "../Icons";
import { PosterZoom } from "./PosterZoom";
import { hasPoster } from "../Poster";
import { languageName } from "@/lib/format";
import type { Film } from "@/lib/types";

/** Top of the film page: the poster itself, enlarged and blurred, is the background. */
export function Hero({ film, backHref }: { film: Film; backHref: string }) {
  const origin = film.isIsraeli ? "ישראל" : languageName(film.language);
  const line1 = [origin, film.year, film.runtime ? `${film.runtime} דק׳` : undefined, film.ageRating && film.ageRating !== "לכל הגילאים" ? `הותר מגיל ${film.ageRating.replace("+", "")}` : film.ageRating].filter(Boolean).join(" · ");
  const lang = languageName(film.language);
  const line2 = film.language ? `${lang}${film.language === "he" ? "" : " · כתוביות בעברית"}` : undefined;
  const genres = film.genres.slice(0, 3).join(" · ");

  return (
    <section className="relative overflow-hidden bg-[#2a2a2a] text-[#f3f4f6]">
      {hasPoster(film) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/poster/${film.id}`} alt="" aria-hidden className="absolute -inset-16 h-[calc(100%+128px)] w-[calc(100%+128px)] max-w-none object-cover opacity-95 blur-[34px] saturate-125" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,14,0.25)_0%,rgba(8,10,14,0.5)_55%,rgba(8,10,14,0.72)_100%)]" />
      <div className="relative mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 pb-5 pt-[max(16px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <Link href={backHref} aria-label="חזרה" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15"><ChevronForward width={20} height={20} /></Link>
        </div>
        <div className="flex gap-4">
          {hasPoster(film) ? (
            <PosterZoom src={`/api/poster/${film.id}`} alt={film.title} />
          ) : (
            <div className="flex h-[165px] w-[110px] shrink-0 items-center justify-center rounded-lg bg-white/10"><FilmIcon width={26} height={26} /></div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="font-serif text-[28px] font-bold leading-[1.15]">{film.title}</h1>
            <div className="flex flex-col gap-[3px] text-[13px] leading-[1.45] text-[#dfe2e8]">
              {line1 && <span>{line1}</span>}
              {line2 && <span>{line2}</span>}
              {genres && <span>{genres}</span>}
            </div>
            {film.imdbRating && (
              <div className="flex gap-2 pt-0.5">
                <span className="inline-flex h-[26px] items-center rounded bg-white/15 px-2 text-[13px] font-semibold">IMDb {film.imdbRating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
        {film.trailerUrl && (
          <a href={film.trailerUrl} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-white/95 text-[15px] font-semibold text-[#101828]">
            <Play width={18} height={18} />
            טריילר
          </a>
        )}
      </div>
    </section>
  );
}
