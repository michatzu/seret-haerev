import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hero } from "@/components/film/Hero";
import { VenueCard } from "@/components/film/VenueCard";
import { FilterSentence } from "@/components/FilterSentence";
import { Group } from "@/components/Group";
import { getData } from "@/lib/data";
import { getPlace } from "@/lib/location";
import { distanceKm } from "@/lib/geo";
import { RADIUS_KM, datesFor, inTimeWindow, matchesHall, parseQuery, queryToSearch } from "@/lib/query";
import { ymdInIsrael } from "@/lib/tz";
import { dayName, formatTime } from "@/lib/format";

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
  const byVenue = new Map<string, typeof data.snapshot.screenings>();
  for (const s of data.byFilm.get(id) ?? []) {
    if (!dates.has(ymdInIsrael(new Date(s.startsAt)))) continue;
    if ((q.day === "today" || q.from !== "now") && !inTimeWindow(s.startsAt, q.from, now)) continue;
    if (q.day !== "today" && new Date(s.startsAt).getTime() < now.getTime()) continue;
    const venue = data.venues.get(s.venueId);
    if (!venue || !matchesHall(s, venue, q.hall)) continue;
    (byVenue.get(s.venueId) ?? byVenue.set(s.venueId, []).get(s.venueId)!).push(s);
  }
  const venues = [...byVenue.entries()]
    .map(([vid, ss]) => ({ venue: data.venues.get(vid)!, distanceKm: distanceKm(place, data.venues.get(vid)!), screenings: ss.sort((a, b) => a.startsAt.localeCompare(b.startsAt)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const near = venues.filter((v) => v.distanceKm <= maxKm);
  const far = venues.filter((v) => v.distanceKm > maxKm);
  const open = near.slice(0, OPEN_VENUES);
  const rest = [...near.slice(OPEN_VENUES), ...far];
  const search = queryToSearch(q);
  const multiDay = q.day === "week";

  return (
    <>
      <Hero film={film} backHref={`/${search}`} />
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-3.5 px-4 pb-10 pt-[18px]">
        {(film.synopsis || film.director || film.cast?.length) && (
          <div className="flex flex-col gap-2.5 px-0.5">
            {film.synopsis && <p className="text-[15px] leading-[1.65] text-ink">{film.synopsis}</p>}
            {(film.director || film.cast?.length) && (
              <div className="flex flex-col gap-[3px] text-[13px] leading-[1.5] text-muted">
                {film.director && <span>במאי: {film.director}</span>}
                {film.cast?.length ? <span>{film.cast.slice(0, 6).join(", ")}</span> : null}
              </div>
            )}
          </div>
        )}
        <div className="h-px bg-line" />
        <FilterSentence q={q} />

        {venues.length === 0 && (
          <div className="rounded-xl border border-line bg-card px-4 py-8 text-center text-[15px] text-muted">אין הקרנות שמתאימות לסינון הזה.</div>
        )}

        <div className="flex flex-col gap-2.5">
          {multiDay
            ? open.map((v) => <WeekVenue key={v.venue.id} v={v} />)
            : open.map((v) => <VenueCard key={v.venue.id} venue={v.venue} distanceKm={v.distanceKm} screenings={v.screenings} />)}
          <Group label={far.length && !near.slice(OPEN_VENUES).length ? "מוקרן רחוק יותר" : "עוד בתי קולנוע"} count={rest.length}>
            {rest.map((v) => (multiDay ? <WeekVenue key={v.venue.id} v={v} /> : <VenueCard key={v.venue.id} venue={v.venue} distanceKm={v.distanceKm} screenings={v.screenings} />))}
          </Group>
        </div>
      </main>
    </>
  );
}

/** Week view: one row per day inside the venue card. */
function WeekVenue({ v }: { v: { venue: { id: string; name: string }; distanceKm: number; screenings: { id: string; startsAt: string; bookingUrl: string }[] } }) {
  const byDay = new Map<string, typeof v.screenings>();
  for (const s of v.screenings) {
    const k = ymdInIsrael(new Date(s.startsAt));
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(s);
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-card p-3.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[15px] font-semibold text-ink">{v.venue.name}</span>
        <span className="text-[13px] text-muted">{formatKm(v.distanceKm)}</span>
      </div>
      <div className="flex flex-col gap-2">
        {[...byDay.entries()].map(([day, ss]) => (
          <div key={day} className="flex items-center gap-2.5">
            <span className="w-[44px] shrink-0 text-[12px] font-medium text-muted">{dayName(ss[0].startsAt)}</span>
            <div className="flex flex-wrap gap-2">
              {ss.slice(0, 4).map((s) => (
                <a key={s.id} href={s.bookingUrl} target="_blank" rel="noopener noreferrer" className="tabular inline-flex h-[38px] items-center rounded-md bg-pill-bg px-3 text-[15px] font-semibold text-pill-ink">{formatTime(s.startsAt)}</a>
              ))}
              {ss.length > 4 && <span className="inline-flex h-[38px] items-center rounded-md bg-plus-bg px-2.5 text-[14px] font-medium text-plus-ink">+{ss.length - 4}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatKm(km: number) {
  if (km < 0.95) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} מ׳`;
  if (km < 10) return `${km.toFixed(1).replace(/\.0$/, "")} ק״מ`;
  return `${Math.round(km)} ק״מ`;
}
