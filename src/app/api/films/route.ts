/** Film details for a list of ids, so the watched page can render without shipping the catalogue. */
import { getData } from "@/lib/data";

export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 300);
  const data = await getData();
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
  return Response.json({ films }, { headers: { "cache-control": "no-store" } });
}
