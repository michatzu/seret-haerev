import Link from "next/link";
import { Poster, hasPoster } from "./Poster";
import { FilmActions } from "./FilmActions";
import { SwipeToFile } from "./SwipeToFile";
import { TimePill, screeningTag } from "./TimePill";
import { ChevronBack } from "./Icons";
import { formatDistance } from "@/lib/geo";
import { formatDaySet, formatDateSet, inVenues, languageName, screeningsCount, venuesCount, withinTheWeek } from "@/lib/format";
import { isMultiDay, pickTimes, weekday, type FilmRow, type Query } from "@/lib/query";
import type { Screening } from "@/lib/types";

const MAX_VENUES = 2;

export function subLine(row: FilmRow["film"]): string {
  // always the spoken language, never the production country: mixing the two read as a mistake
  const parts = [languageName(row.language), row.year ? String(row.year) : undefined].filter(Boolean);
  let s = parts.join(", ");
  if (row.imdbRating) s += `${s ? " · " : ""}IMDb ${row.imdbRating.toFixed(1)}`;
  return s;
}

export function FilmCard({ row, q, search }: { row: FilmRow; q: Query; search: string }) {
  // by proximity, except when the user sorts by time: then the venue with the earliest screening leads
  const ordered = q.sort === "time" ? [...row.venues].sort((a, b) => a.screenings[0].startsAt.localeCompare(b.screenings[0].startsAt) || a.distanceKm - b.distanceKm) : row.venues;
  const shown = ordered.slice(0, MAX_VENUES);
  const shownCount = shown.reduce((n, v) => n + (isMultiDay(q.day) ? v.screenings.length : Math.min(v.screenings.length, pickTimes(v.screenings).length)), 0);
  const restScreenings = row.total - shownCount;
  const restVenues = row.venues.length - shown.length;
  const more =
    isMultiDay(q.day)
      ? restVenues > 0 ? `עוד ${venuesCount(restVenues)}` : undefined
      : restScreenings > 0
        ? `עוד ${screeningsCount(restScreenings)}${restVenues > 0 ? ` ${inVenues(restVenues)}` : ""}`
        : undefined;
  const href = `/film/${row.film.id}${search}`;

  return (
    <SwipeToFile filmId={row.film.id}>
    <article data-film={row.film.id} className="flex gap-3 rounded-xl border border-line bg-card p-3.5">
      <Link href={href} className="shrink-0" aria-label={row.film.title}>
        <Poster filmId={row.film.id} hasPoster={hasPoster(row.film)} alt="" width={56} height={84} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <Link href={href} className="font-serif text-[19px] font-bold leading-[1.2] text-ink">{row.film.title}</Link>
            <div className="text-[12px] text-muted">{subLine(row.film)}</div>
          </div>
          <FilmActions filmId={row.film.id} title={row.film.title} />
        </div>
        <div className="flex flex-col gap-1.5">
          {shown.map((v) => (
            <div key={v.venue.id} className="flex items-center gap-1.5 whitespace-nowrap text-[13px]">
              <span className="truncate font-medium text-ink">{v.venue.name}</span>
              <span className="text-muted">{formatDistance(v.distanceKm)}</span>
              <span className="ms-auto flex shrink-0 gap-1.5">
                {isMultiDay(q.day) ? <WeekPills ss={v.screenings} /> : <DayPills ss={v.screenings} />}
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
    </SwipeToFile>
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
/**
 * Over a week a weekday letter is enough; past that it is ambiguous, so anything beyond the coming
 * seven days is shown as a date instead.
 */
function WeekPills({ ss }: { ss: Screening[] }) {
  const tags = new Set(ss.map(screeningTag));
  const tag = tags.size === 1 ? [...tags][0] : undefined;
  const soon = ss.filter((s) => withinTheWeek(s.startsAt));
  const later = ss.filter((s) => !withinTheWeek(s.startsAt));
  if (!later.length) return <TimePill label={formatDaySet(soon.map((s) => weekday(s.startsAt)))} tag={tag} />;
  return (
    <>
      {soon.length > 0 && <TimePill label={formatDaySet(soon.map((s) => weekday(s.startsAt)))} />}
      <TimePill label={formatDateSet(later.map((s) => s.startsAt))} tag={tag} />
    </>
  );
}
