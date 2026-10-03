/** The site's own mark, between its name and the place it is showing. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="13" fill="#1a1e26" />
      <rect x="8" y="14" width="48" height="31" rx="3" fill="#ffd36e" />
      <g fill="#1a1e26">
        <path d="M14 45a7 7 0 0 1 14 0Z" />
        <path d="M32 45a7 7 0 0 1 14 0Z" />
      </g>
    </svg>
  );
}
