import { ImageResponse } from "next/og";
import { CUE, HEADS, SCREEN } from "@/lib/markShapes";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The tab icon: the room fills the whole square, so there is no edge to see at this size. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#12151b" }}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <rect width="64" height="64" fill="#12151b" />
          <rect {...SCREEN} fill="#ffd36e" />
          <circle cx={CUE.cx} cy={CUE.cy} r={CUE.r} fill="none" stroke="#12151b" strokeWidth={CUE.strokeWidth} />
          <g fill="#12151b">{HEADS.map((d) => <path key={d} d={d} />)}</g>
        </svg>
      </div>
    ),
    size,
  );
}
