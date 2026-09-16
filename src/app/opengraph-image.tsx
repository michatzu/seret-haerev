import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
        <svg width="168" height="168" viewBox="0 0 64 64">
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
