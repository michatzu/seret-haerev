import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hero } from "@/components/film/Hero";
import { VenueCard } from "@/components/film/VenueCard";
import { FilterSentence } from "@/components/FilterSentence";
import { LazyGroup } from "@/components/LazyGroup";
import { FilmActions } from "@/components/FilmActions";
import { getData } from "@/lib/data";
import { getPlace } from "@/lib/location";
import { distanceKm, formatDistance } from "@/lib/geo";
import { venueOptions } from "@/lib/options";
import { RADIUS_KM, datesFor, isMultiDay, parseQuery, passes, queryToSearch } from "@/lib/query";
import { ymdInIsrael } from "@/lib/tz";
import { dayOrDate, formatTime } from "@/lib/format";
import type { Screening } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/film/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const data = await getData();
  const film = data.films.get(id);
  return { title: film?.title ?? "סרט", description: film?.synopsis?.slice(0, 160) };
}

const OPEN_VENUES = 3;

export default async function FilmPage(props: PageProps<"/film/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const q = parseQuery(sp);
  const [place, data] = await Promise.all([getPlace(), getData()]);
  const film = data.films.get(id);
  if (!film) notFound();

  const now = new Date();
  const dates = new Set(datesFor(q.day, now));
  const maxKm = RADIUS_KM[q.radius];
  const byVenue = new Map<string, Screening[]>();
  for (const s of data.byFilm.get(id) ?? []) {
    const venue = data.venues.get(s.venueId);
    if (!venue || !passes(s, film, venue, { ...q, genres: [] }, dates, now)) continue;
    (byVenue.get(s.venueId) ?? byVenue.set(s.venueId, []).get(s.venueId)!).push(s);
  }
  const venues = [...byVenue.entries()]
    .map(([vid, ss]) => ({ venue: data.venues.get(vid)!, distanceKm: distanceKm(place, data.venues.get(vid)!), screenings: ss.sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const near = venues.filter((v) => v.distanceKm <= maxKm);
  const far = venues.filter((v) => v.distanceKm > maxKm);
  const open = near.slice(0, OPEN_VENUES);
  const rest = [...near.slice(OPEN_VENUES), ...far];
  const listSearch = queryToSearch({ ...q, kids: false, small: false, far: false, venues: q.venues });
  const multiDay = isMultiDay(q.day);

  return (
    <>
      <Hero film={film} backHref={`/${listSearch}`} />
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-3.5 px-4 pb-10 pt-[18px]">
        {(film.synopsis || film.director || film.cast?.length) && (
          <div className="flex flex-col gap-2.5 px-0.5">
            {film.synopsis && <p className="text-[15px] leading-[1.65] text-ink">{film.synopsis}</p>}
            {(film.director || film.cast?.length) && (
              <div className="flex flex-col gap-[3px] text-[13px] leading-[1.5] text-muted">
                {film.director && <span>בימוי: {film.director}</span>}
                {film.cast?.length ? <span>משחק: {film.cast.slice(0, 4).join(", ")}</span> : null}
              </div>
            )}
          </div>
        )}
        <FilmActions filmId={film.id} title={film.title} size="page" />
        <div className="h-px bg-line" />
        <FilterSentence q={q} venues={venueOptions(data.venues.values(), place)} genres={[]} showGenres={false} />

        {venues.length === 0 && (
          <div className="rounded-xl border border-line bg-card px-4 py-8 text-center text-[15px] text-muted">אין הקרנות של הסרט הזה בסינון הנוכחי. נסו יום אחר או מרחק גדול יותר.</div>
        )}

        <div className="flex flex-col gap-2.5">
          {open.map((v) => (multiDay ? <WeekVenue key={v.venue.id} v={v} /> : <VenueCard key={v.venue.id} venue={v.venue} distanceKm={v.distanceKm} screenings={v.screenings} film={film.title} />))}
          <LazyGroup label={near.length > OPEN_VENUES ? "עוד בתי קולנוע" : "מוקרן רחוק יותר"} count={rest.length} param="far" open={q.far}>
            {q.far && rest.map((v) => (multiDay ? <WeekVenue key={v.venue.id} v={v} /> : <VenueCard key={v.venue.id} venue={v.venue} distanceKm={v.distanceKm} screenings={v.screenings} film={film.title} />))}
          </LazyGroup>
        </div>
      </main>
    </>
  );
}

/** Week view: one row per day inside the venue card. */
function WeekVenue({ v }: { v: { venue: { id: string; name: string }; distanceKm: number; screenings: Screening[] } }) {
  const byDay = new Map<string, Screening[]>();
  for (const s of v.screenings) {
    const k = ymdInIsrael(new Date(s.startsAt));
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(s);
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-card p-3.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[15px] font-semibold text-ink">{v.venue.name}</span>
        <span className="text-[13px] text-muted">{formatDistance(v.distanceKm)}</span>
      </div>
      <div className="flex flex-col gap-2">
        {[...byDay.entries()].map(([day, ss]) => (
          <div key={day} className="flex items-center gap-2.5">
            <span className="w-[52px] shrink-0 text-[12px] font-medium text-muted">{dayOrDate(ss[0].startsAt)}</span>
            <div className="flex flex-wrap gap-2">
              {ss.slice(0, 4).map((s) => (
                <a key={s.id} href={s.bookingUrl} target="_blank" rel="noopener noreferrer" data-booking data-venue={v.venue.name} data-hall="רגיל" className="tabular inline-flex h-[38px] items-center rounded-md bg-pill-bg px-3 text-[15px] font-semibold text-pill-ink">{formatTime(s.startsAt)}</a>
              ))}
              {ss.length > 4 && <span className="inline-flex h-[38px] items-center rounded-md bg-plus-bg px-2.5 text-[14px] font-medium text-plus-ink">+{ss.length - 4}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
