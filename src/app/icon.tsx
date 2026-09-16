import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * A film frame with the evening in it. It has to read at sixteen pixels in a browser tab, so the
 * mark is two shapes and nothing else: the perforated strip, and the moon that makes it tonight.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#12151b" }}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <rect x="10" y="12" width="44" height="40" rx="7" fill="#8fd6da" />
          <g fill="#12151b">
            <rect x="15" y="17" width="6" height="5" rx="1.6" />
            <rect x="15" y="29.5" width="6" height="5" rx="1.6" />
            <rect x="15" y="42" width="6" height="5" rx="1.6" />
            <rect x="43" y="17" width="6" height="5" rx="1.6" />
            <rect x="43" y="29.5" width="6" height="5" rx="1.6" />
            <rect x="43" y="42" width="6" height="5" rx="1.6" />
          </g>
          <path d="M37.5 32a9 9 0 1 1-9.6-9 7.2 7.2 0 0 0 9.6 9Z" fill="#12151b" />
        </svg>
      </div>
    ),
    size,
  );
}
