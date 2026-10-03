import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The dark room and the lit screen. Two heads below it, so it is a screening and not a window. */
export const MARK = (
  <svg width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="#12151b" />
    <rect x="8" y="14" width="48" height="31" rx="3" fill="#ffd36e" />
    <g fill="#12151b">
      <path d="M14 45a7 7 0 0 1 14 0Z" />
      <path d="M32 45a7 7 0 0 1 14 0Z" />
    </g>
  </svg>
);

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#12151b" }}>{MARK}</div>,
    size,
  );
}
