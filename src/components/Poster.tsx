import { Film } from "./Icons";

export function Poster({ src, alt, className = "", width, height }: { src?: string; alt: string; className?: string; width: number; height: number }) {
  if (!src) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-md bg-ph text-ph-ink ${className}`} style={{ width, height }} aria-hidden>
        <Film width={22} height={22} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" className={`shrink-0 rounded-md bg-ph object-cover ${className}`} style={{ width, height }} />
  );
}
