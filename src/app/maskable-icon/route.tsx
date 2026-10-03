/**
 * The icon Android puts on a home screen.
 *
 * Without one marked "maskable", Android assumes the icon is a logo on nothing and sets it on a
 * white circle of its own. A maskable icon fills its square and keeps everything that matters
 * inside the middle 80%, because the launcher crops the rest to whatever shape the phone uses —
 * so the room runs edge to edge and the mark is scaled down into the part nothing will cut.
 */
import { ImageResponse } from "next/og";
import { CUE, HEADS, SCREEN } from "@/lib/markShapes";

/** The mark at 64% of the square, about its centre. */
const K = 0.64;

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#12151b" }}>
        <svg width="512" height="512" viewBox="0 0 64 64">
          <rect width="64" height="64" fill="#12151b" />
          <g transform={`translate(${32 - 32 * K} ${32 - 32 * K}) scale(${K})`}>
            <rect {...SCREEN} fill="#ffd36e" />
            <circle cx={CUE.cx} cy={CUE.cy} r={CUE.r} fill="none" stroke="#12151b" strokeWidth={CUE.strokeWidth} />
            <g fill="#12151b">{HEADS.map((d) => <path key={d} d={d} />)}</g>
          </g>
        </svg>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
