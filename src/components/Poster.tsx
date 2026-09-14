import { Film } from "./Icons";

/** Poster for a film. Always points at /api/poster/[id], which resolves the best working source. */
export function Poster({ filmId, hasPoster, alt, className = "", width, height }: { filmId: string; hasPoster: boolean; alt: string; className?: string; width: number; height: number }) {
  if (!hasPoster) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-md bg-ph text-ph-ink ${className}`} style={{ width, height }} aria-hidden>
        <Film width={22} height={22} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/poster/${filmId}`} alt={alt} width={width} height={height} loading="lazy" decoding="async" className={`shrink-0 rounded-md bg-ph object-cover ${className}`} style={{ width, height }} />
  );
}

/** True when the scraper found at least one poster candidate for this film. */
export const hasPoster = (f: { posterUrl?: string; posterUrls?: string[] }) => !!(f.posterUrl || f.posterUrls?.length);
