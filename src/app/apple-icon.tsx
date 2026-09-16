import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon. iOS rounds the corners itself, so this fills the square edge to edge. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#12151b" }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <rect x="9" y="11" width="46" height="42" rx="7" fill="#8fd6da" />
          <g fill="#12151b">
            <rect x="14" y="16" width="6.5" height="5.2" rx="1.6" />
            <rect x="14" y="29.4" width="6.5" height="5.2" rx="1.6" />
            <rect x="14" y="42.8" width="6.5" height="5.2" rx="1.6" />
            <rect x="43.5" y="16" width="6.5" height="5.2" rx="1.6" />
            <rect x="43.5" y="29.4" width="6.5" height="5.2" rx="1.6" />
            <rect x="43.5" y="42.8" width="6.5" height="5.2" rx="1.6" />
          </g>
          <path d="M38 32a9.5 9.5 0 1 1-10.1-9.5A7.6 7.6 0 0 0 38 32Z" fill="#12151b" />
        </svg>
      </div>
    ),
    size,
  );
}
