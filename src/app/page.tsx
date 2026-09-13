import { Header } from "@/components/Header";
import { SortSegment } from "@/components/SortSegment";
import { FilmCard } from "@/components/FilmCard";
import { Group } from "@/components/Group";
import { getData } from "@/lib/data";
import { getPlace } from "@/lib/location";
import { buildList, parseQuery, queryToSearch } from "@/lib/query";
import { formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const q = parseQuery(sp);
  const [place, data] = await Promise.all([getPlace(), getData()]);
  const now = new Date();
  const list = buildList(data.films, data.venues, data.snapshot.screenings, q, place, now);
  const search = queryToSearch(q);

  return (
    <>
      <Header q={q} place={place} />
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-3 px-4 pb-10 pt-3.5">
        <SortSegment q={q} />

        {list.main.length === 0 && (
          <div className="rounded-xl border border-line bg-card px-4 py-8 text-center text-[15px] text-muted">
            אין הקרנות שמתאימות לסינון הזה.
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {list.main.map((row) => (
            <FilmCard key={row.film.id} row={row} q={q} search={search} />
          ))}
          <Group label="לילדים ומדובבים" count={list.kids.length}>
            {list.kids.map((row) => (
              <FilmCard key={row.film.id} row={row} q={q} search={search} />
            ))}
          </Group>
          <Group label="מוקרן רחוק יותר" count={list.farther.length}>
            {list.farther.map((row) => (
              <FilmCard key={row.film.id} row={row} q={q} search={search} />
            ))}
          </Group>
        </div>

        <p className="pt-4 text-center text-[12px] text-muted">
          עודכן {formatTime(data.snapshot.generatedAt)} · לחיצה על שעה פותחת את הקופה של בית הקולנוע
        </p>
      </main>
    </>
  );
}
