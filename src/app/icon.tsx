import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The tab icon: the room is the whole square, so there is no edge to see at this size. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#12151b" }}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <rect width="64" height="64" fill="#12151b" />
          <rect x="7" y="12" width="50" height="33" rx="3" fill="#ffd36e" />
          <g fill="#12151b">
            <path d="M13 50a8 8 0 0 1 16 0Z" />
            <path d="M34 50a8 8 0 0 1 16 0Z" />
            <rect x="7" y="45" width="50" height="7" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
