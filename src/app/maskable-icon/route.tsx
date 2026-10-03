/**
 * The icon Android puts on a home screen.
 *
 * Without one marked "maskable", Android assumes the icon is a logo on nothing and sets it on a
 * white circle of its own. A maskable icon is expected to fill its square and to keep everything
 * that matters inside the middle 80%, because the launcher will crop the rest to whatever shape
 * the phone uses — so the room runs edge to edge and the screen sits well inside it.
 */
import { ImageResponse } from "next/og";

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#12151b" }}>
        <svg width="512" height="512" viewBox="0 0 64 64">
          <rect width="64" height="64" fill="#12151b" />
          <rect x="16" y="21" width="32" height="20" rx="2.4" fill="#ffd36e" />
          <g fill="#12151b">
            <path d="M19.5 44a5.2 5.2 0 0 1 10.4 0Z" />
            <path d="M33.8 44a5.2 5.2 0 0 1 10.4 0Z" />
            <rect x="16" y="41" width="32" height="4" />
          </g>
        </svg>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
