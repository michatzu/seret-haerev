import type { MetadataRoute } from "next";
import { getData } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

/** Rebuilt hourly: films come and go with the schedule, and a page for a film nobody shows is a dead end. */
export const revalidate = 3600;

/**
 * The home page, the static pages, and a page for every film that still has a screening ahead.
 * Shows, talks and stage events are left out: someone searching for a film is who the site is for.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getData();
  const updated = new Date(data.snapshot.generatedAt);
  const now = Date.now();
  const films = data.snapshot.films.filter(
    (f) => !f.isEvent && (data.byFilm.get(f.id) ?? []).some((s) => new Date(s.startsAt).getTime() > now),
  );
  return [
    { url: SITE_URL, lastModified: updated, changeFrequency: "hourly", priority: 1 },
    ...films.map((f) => ({ url: `${SITE_URL}/film/${f.id}`, lastModified: updated, changeFrequency: "daily" as const, priority: 0.7 })),
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
