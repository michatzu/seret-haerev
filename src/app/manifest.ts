import type { MetadataRoute } from "next";

/** So "add to home screen" gets the right name and opens without browser chrome. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "סרט הערב",
    short_name: "סרט הערב",
    description: "מה מוקרן לידך היום, בכל בתי הקולנוע בישראל, במקום אחד.",
    start_url: "/",
    display: "standalone",
    background_color: "#12151b",
    theme_color: "#12151b",
    lang: "he",
    dir: "rtl",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
