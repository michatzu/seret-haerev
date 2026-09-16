import Link from "next/link";
import { Header } from "@/components/Header";
import { SortSegment } from "@/components/SortSegment";
import { SearchBox } from "@/components/SearchBox";
import { FilmCard } from "@/components/FilmCard";
import { LazyGroup } from "@/components/LazyGroup";
import { getData } from "@/lib/data";
import { getPlace } from "@/lib/location";
import { genreOptions, venueOptions } from "@/lib/options";
import { buildList, parseQuery, queryToSearch } from "@/lib/query";
import { Freshness } from "@/components/Freshness";

export const dynamic = "force-dynamic";

export default async function Home(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const q = parseQuery(sp);
  const [place, data] = await Promise.all([getPlace(), getData()]);
  const now = new Date();
  const list = buildList(data.films, data.venues, data.snapshot.screenings, q, place, now);
  const search = queryToSearch({ ...q, kids: false, small: false, far: false });

  return (
    <>
      <Header q={q} place={place} venues={venueOptions(data.venues.values(), place)} genres={genreOptions(data.films.values())} />
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-3 px-4 pb-10 pt-3.5">
        <SearchBox q={q} />
        <SortSegment q={q} />

        {list.main.length === 0 && (
          <div className="rounded-xl border border-line bg-card px-4 py-8 text-center text-[15px] text-muted">אין הקרנות שמתאימות לסינון הזה. אפשר להרחיב את המרחק או את השעה.</div>
        )}

        <div className="flex flex-col gap-2.5">
          {list.main.map((row) => (
            <FilmCard key={row.film.id} row={row} q={q} search={search} />
          ))}
          <LazyGroup label="לילדים ומדובבים" count={list.kids.length} param="kids" open={q.kids}>
            {q.kids && list.kids.map((row) => <FilmCard key={row.film.id} row={row} q={q} search={search} />)}
          </LazyGroup>
          <LazyGroup label="סרטים שלא מצאנו את הכרזה שלהם" count={list.small.length} param="small" open={q.small}>
            {q.small && list.small.map((row) => <FilmCard key={row.film.id} row={row} q={q} search={search} />)}
          </LazyGroup>
          <LazyGroup label="מוקרן רחוק יותר" count={list.farther.length} param="far" open={q.far}>
            {q.far && list.farther.map((row) => <FilmCard key={row.film.id} row={row} q={q} search={search} />)}
          </LazyGroup>
        </div>

        <p className="flex flex-wrap justify-center gap-x-2 pt-4 text-center text-[12px] text-muted">
          <Freshness generatedAt={data.snapshot.generatedAt} now={now} />
          <span>·</span>
          <span>לחיצה על שעה פותחת את הקופה של בית הקולנוע</span>
          <span>·</span>
          <Link href="/privacy" className="underline decoration-dotted">פרטיות</Link>
        </p>
      </main>
    </>
  );
}
