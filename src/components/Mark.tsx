/**
 * The site's own mark: a lit screen with two heads in front of it.
 *
 * The screen's bottom edge is cut away where the heads are, so they are the dark of the room
 * carrying on past it rather than two holes punched in a card. The hairline keeps the whole thing
 * from dissolving into a page that is nearly the same colour.
 */
export function Mark({ size = 26, bg = "#12151b", hairline = true }: { size?: number; bg?: string; hairline?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="13" fill={bg} />
      {hairline && <rect x="0.7" y="0.7" width="62.6" height="62.6" rx="12.3" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.2" />}
      <rect x="8" y="13" width="48" height="31" rx="3" fill="#ffd36e" />
      <g fill={bg}>
        <path d="M14 48a7.6 7.6 0 0 1 15.2 0Z" />
        <path d="M34 48a7.6 7.6 0 0 1 15.2 0Z" />
        <rect x="8" y="44" width="48" height="6" />
      </g>
    </svg>
  );
}
