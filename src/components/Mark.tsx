import { CUE, HEADS, SCREEN } from "@/lib/markShapes";

/**
 * The site's own mark.
 *
 * The screen's lower edge is cut away where the heads are, so they are the dark of the room
 * carrying on past it rather than two bites taken out of a card. The hairline keeps the whole
 * thing from dissolving into a page of nearly the same colour.
 */
export function Mark({ size = 26, bg = "#12151b", hairline = true }: { size?: number; bg?: string; hairline?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="13" fill={bg} />
      {hairline && <rect x="0.7" y="0.7" width="62.6" height="62.6" rx="12.3" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.2" />}
      <rect {...SCREEN} fill="#ffd36e" />
      <circle cx={CUE.cx} cy={CUE.cy} r={CUE.r} fill="none" stroke={bg} strokeWidth={CUE.strokeWidth} />
      <g fill={bg}>
        {HEADS.map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  );
}
