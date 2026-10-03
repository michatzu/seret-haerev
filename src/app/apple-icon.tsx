import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon. iOS rounds the corners itself, so the dark room fills the square. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#12151b" }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <rect width="64" height="64" fill="#12151b" />
          <rect x="9" y="15" width="46" height="29" rx="3" fill="#ffd36e" />
          <g fill="#12151b">
            <path d="M14 48a7.4 7.4 0 0 1 14.8 0Z" />
            <path d="M34.5 48a7.4 7.4 0 0 1 14.8 0Z" />
            <rect x="9" y="44" width="46" height="6" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
