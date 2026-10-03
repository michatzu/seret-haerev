import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CUE, HEADS, SCREEN } from "@/lib/markShapes";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "סרט הערב";

const fonts = join(process.cwd(), "assets/fonts");
const [regular, semibold] = await Promise.all([
  readFile(join(fonts, "IBMPlexSansHebrew-Regular.ttf")),
  readFile(join(fonts, "IBMPlexSansHebrew-SemiBold.ttf")),
]);

const LATIN_RUN = /[A-Za-z0-9]+(?:[.'’\-/][A-Za-z0-9]+)*/g;

/**
 * The renderer behind this image draws characters in the order they are written, left to right,
 * with no bidirectional pass — so Hebrew comes out back to front. Reversing the line hands it the
 * order it should paint, and any Latin or numeric run inside has to be turned back the right way
 * round. Enough for the few hand-written lines below; it is not the bidi algorithm.
 */
function visual(text: string): string {
  return [...text]
    .reverse()
    .join("")
    .replace(LATIN_RUN, (run) => [...run].reverse().join(""));
}

/** What a shared link looks like in WhatsApp and elsewhere. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          background: "#12151b",
          color: "#f3f4f6",
          fontFamily: "IBM Plex Sans Hebrew",
        }}
      >
        <svg width="176" height="176" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="12" fill="#1a1e26" />
          <rect {...SCREEN} fill="#ffd36e" />
          <circle cx={CUE.cx} cy={CUE.cy} r={CUE.r} fill="none" stroke="#1a1e26" strokeWidth={CUE.strokeWidth} />
          <g fill="#1a1e26">{HEADS.map((d) => <path key={d} d={d} />)}</g>
        </svg>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 600 }}>{visual("סרט הערב")}</div>
        <div style={{ display: "flex", fontSize: 38, color: "#9aa1ad" }}>
          {visual("מה מוקרן לידך היום, בכל בתי הקולנוע בישראל")}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "IBM Plex Sans Hebrew", data: regular, weight: 400, style: "normal" },
        { name: "IBM Plex Sans Hebrew", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
