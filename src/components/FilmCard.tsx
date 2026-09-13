import Link from "next/link";
import { Poster } from "./Poster";
import { TimePill, screeningTag } from "./TimePill";
import { ChevronBack } from "./Icons";
import { formatDistance } from "@/lib/geo";
import { formatDaySet, languageName } from "@/lib/format";
import { pickTimes, weekday, type FilmRow, type Query } from "@/lib/query";
import type { Screening } from "@/lib/types";

const MAX_VENUES = 2;

export function subLine(row: FilmRow["film"]): string {
  const origin = row.isIsraeli ? "ישראל" : languageName(row.language);
  const parts = [origin, row.year ? String(row.year) : undefined].filter(Boolean);
  let s = parts.join(", ");
  if (row.imdbRating) s += `${s ? " · " : ""}IMDb ${row.imdbRating.toFixed(1)}`;
  return s;
}

export function FilmCard({ row, q, search }: { row: FilmRow; q: Query; search: string }) {
  // by proximity, except when the user sorts by time: then the venue with the earliest screening leads
  const ordered = q.sort === "time" ? [...row.venues].sort((a, b) => a.screenings[0].startsAt.localeCompare(b.screenings[0].startsAt) || a.distanceKm - b.distanceKm) : row.venues;
  const shown = ordered.slice(0, MAX_VENUES);
  const shownCount = shown.reduce((n, v) => n + (q.day === "week" ? v.screenings.length : Math.min(v.screenings.length, pickTimes(v.screenings).length)), 0);
  const restScreenings = row.total - shownCount;
  const restVenues = row.venues.length - shown.length;
  const more =
    q.day === "week"
      ? restVenues > 0 ? `עוד ${restVenues} בתי קולנוע` : undefined
      : restScreenings > 0
        ? `עוד ${restScreenings} הקרנות${restVenues > 0 ? ` ב־${restVenues} בתי קולנוע` : ""}`
        : undefined;
  const href = `/film/${row.film.id}${search}`;

  return (
    <article className="flex gap-3 rounded-xl border border-line bg-card p-3.5">
      <Link href={href} className="shrink-0" aria-label={row.film.title}>
        <Poster src={row.film.posterUrl} alt="" width={56} height={84} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-[3px]">
          <Link href={href} className="font-serif text-[19px] font-bold leading-[1.2] text-ink">{row.film.title}</Link>
          <div className="text-[12px] text-muted">{subLine(row.film)}</div>
        </div>
        <div className="flex flex-col gap-1.5">
          {shown.map((v) => (
            <div key={v.venue.id} className="flex items-center gap-1.5 whitespace-nowrap text-[13px]">
              <span className="truncate font-medium text-ink">{v.venue.name}</span>
              <span className="text-muted">{formatDistance(v.distanceKm)}</span>
              <span className="ms-auto flex shrink-0 gap-1.5">
                {q.day === "week" ? <WeekPills ss={v.screenings} /> : <DayPills ss={v.screenings} />}
              </span>
            </div>
          ))}
        </div>
        {more && (
          <Link href={href} className="flex min-h-[24px] items-center gap-1 text-[13px] font-medium text-accent">
            <span>{more}</span>
            <ChevronBack width={16} height={16} />
          </Link>
        )}
      </div>
    </article>
  );
}

/** Today / single day: next + prime screening; only one when a tag needs the room. */
function DayPills({ ss }: { ss: Screening[] }) {
  let picked = pickTimes(ss, 2);
  const tags = picked.map(screeningTag);
  if (picked.length > 1 && tags.some(Boolean)) picked = [picked[0]];
  return (
    <>
      {picked.map((s) => (
        <TimePill key={s.id} s={s} tag={screeningTag(s)} />
      ))}
    </>
  );
}

/** Week: which days, plus a tag when every screening at that venue shares it. */
function WeekPills({ ss }: { ss: Screening[] }) {
  const days = ss.map((s) => weekday(s.startsAt));
  const tags = new Set(ss.map(screeningTag));
  const tag = tags.size === 1 ? [...tags][0] : undefined;
  return <TimePill label={formatDaySet(days)} tag={tag} />;
}
