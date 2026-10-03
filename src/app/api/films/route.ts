/** Film details for a list of ids, so the watched page can render without shipping the catalogue. */
import { getData } from "@/lib/data";

export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 300);
  const data = await getData();
  const retired = data.snapshot.retired ?? {};
  const films = ids
    .map((id) => data.films.get(id))
    .filter((f) => !!f)
    .map((f) => ({
      id: f.id,
      title: f.title,
      year: f.year,
      language: f.language,
      imdbRating: f.imdbRating,
      hasPoster: !!(f.posterUrl || f.posterUrls?.length),
      screenings: (data.byFilm.get(f.id) ?? []).filter((s) => new Date(s.startsAt).getTime() > Date.now()).length,
    }));
  // A film can leave every cinema while it is still in somebody's list; the schedule no longer
  // holds it, but its name is kept so the list is not left with a blank row.
  const gone = ids
    .filter((id) => !data.films.has(id) && retired[id])
    .map((id) => ({ id, title: retired[id].title, year: retired[id].year, hasPoster: false, screenings: 0 }));
  return Response.json({ films: [...films, ...gone] }, { headers: { "cache-control": "no-store" } });
}
