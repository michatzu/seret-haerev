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
          <rect x="8" y="13" width="48" height="31" rx="3" fill="#ffd36e" />
          <g fill="#12151b">
        <path d="M14 50a7.6 12.5 0 0 1 15.2 0Z" />
        <path d="M34 50a7.6 12.5 0 0 1 15.2 0Z" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
