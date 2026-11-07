import { ImageResponse } from "next/og";
import { getData } from "@/lib/data";
import { fetchPoster, posterCandidates } from "@/lib/posterFetch";
import { Mark, OG_COLORS as C, OG_FONTS, visual, wrap } from "@/lib/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "כרזת הסרט, ואיפה ומתי הוא מוקרן בסרט הערב";

const POSTER_TRIES = 3;
/**
 * The renderer's own default is to cache the image for a year as immutable. A poster can turn up a
 * day after its film does, so an image drawn without one is kept for an hour, and one with it for
 * a day in the browser and a week at Vercel's edge.
 */
const CACHE_WITH_POSTER = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";
const CACHE_WITHOUT_POSTER = "public, max-age=3600, s-maxage=3600";

/** The renderer reads JPEG and PNG only, so a chain's WebP or AVIF poster is passed over for the next one. */
async function posterSrc(data: Awaited<ReturnType<typeof getData>>, id: string): Promise<string | null> {
  for (const url of posterCandidates(data, id).slice(0, POSTER_TRIES)) {
    const hit = await fetchPoster(url, "image/jpeg,image/png");
    if (hit && (hit.type === "image/jpeg" || hit.type === "image/png")) {
      return `data:${hit.type};base64,${Buffer.from(hit.body).toString("base64")}`;
    }
  }
  return null;
}

/**
 * What a link to a film looks like in WhatsApp: its poster, its name, and what the site will do
 * with it. Nothing that changes by the hour, such as times or cinemas, since the preview is cached
 * by every app it passes through.
 */
export default async function FilmOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getData();
  const film = data.films.get(id);
  const kept = data.snapshot.retired?.[id];
  const title = film?.title ?? kept?.title ?? "סרט הערב";
  const meta = [film?.year ?? kept?.year, film?.director].filter(Boolean).join(" · ");
  const poster = await posterSrc(data, id);
  const long = title.length > 30;
  const lines = wrap(title, long ? 23 : 18, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          gap: 56,
          padding: 72,
          background: C.bg,
          color: C.ink,
          fontFamily: "IBM Plex Sans Hebrew",
        }}
      >
        <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: long ? 52 : 64, fontWeight: 600, lineHeight: 1.15 }}>
              {lines.map((line) => <div key={line} style={{ display: "flex" }}>{visual(line)}</div>)}
            </div>
            {meta && <div style={{ display: "flex", fontSize: 32, color: C.muted }}>{visual(meta)}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 20 }}>
            <div style={{ display: "flex", fontSize: 36, color: C.accent }}>{visual("איפה ומתי מוקרן לידך")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>{visual("סרט הערב")}</div>
              <Mark size={64} />
            </div>
          </div>
        </div>
        {poster ? (
          <img src={poster} width={324} height={486} alt="" style={{ borderRadius: 16, objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", width: 324, height: 486, alignItems: "center", justifyContent: "center", borderRadius: 16, background: C.tile }}>
            <Mark size={150} />
          </div>
        )}
      </div>
    ),
    { ...size, fonts: OG_FONTS, headers: { "cache-control": poster ? CACHE_WITH_POSTER : CACHE_WITHOUT_POSTER } },
  );
}
