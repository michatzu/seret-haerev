import { ImageResponse } from "next/og";
import { Mark, OG_COLORS as C, OG_FONTS, visual } from "@/lib/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "סרט הערב";

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
          background: C.bg,
          color: C.ink,
          fontFamily: "IBM Plex Sans Hebrew",
        }}
      >
        <Mark size={176} />
        <div style={{ display: "flex", fontSize: 92, fontWeight: 600 }}>{visual("סרט הערב")}</div>
        <div style={{ display: "flex", fontSize: 38, color: C.muted }}>
          {visual("מה מוקרן לידך היום, בכל בתי הקולנוע בישראל")}
        </div>
      </div>
    ),
    { ...size, fonts: OG_FONTS },
  );
}
