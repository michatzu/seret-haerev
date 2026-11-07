import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CUE, HEADS, SCREEN } from "@/lib/markShapes";

/** What the share images are drawn with: the site's own Hebrew face, read once per server. */
const fonts = join(process.cwd(), "assets/fonts");
const [regular, semibold] = await Promise.all([
  readFile(join(fonts, "IBMPlexSansHebrew-Regular.ttf")),
  readFile(join(fonts, "IBMPlexSansHebrew-SemiBold.ttf")),
]);

export const OG_FONTS = [
  { name: "IBM Plex Sans Hebrew", data: regular, weight: 400 as const, style: "normal" as const },
  { name: "IBM Plex Sans Hebrew", data: semibold, weight: 600 as const, style: "normal" as const },
];

export const OG_COLORS = { bg: "#12151b", tile: "#1a1e26", ink: "#f3f4f6", muted: "#9aa1ad", accent: "#ffd36e" };

/** A run of Latin words and numbers, with the spaces and punctuation between them: it reads left to right as a whole. */
const LATIN_RUN = /[A-Za-z0-9]+(?:[.'’\-/:,&!? ]+[A-Za-z0-9]+)*/g;
const MIRROR: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[" };

/**
 * The renderer behind these images draws characters in the order they are written, left to right,
 * with no bidirectional pass, so Hebrew comes out back to front. Reversing the line hands it the
 * order it should paint; brackets are mirrored, as a right-to-left line shows them; and a Latin or
 * numeric run inside is turned back the right way round, words in order. Enough for a title and a
 * line or two; it is not the bidi algorithm.
 */
export function visual(text: string): string {
  return [...text]
    .reverse()
    .map((c) => MIRROR[c] ?? c)
    .join("")
    .replace(LATIN_RUN, (run) => [...run].reverse().join(""));
}

/**
 * Breaks a line into lines of at most about `max` characters, at spaces, in reading order. It has
 * to happen before `visual`, since the renderer would otherwise wrap a reversed line from its end.
 */
export function wrap(text: string, max: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && (last + " " + word).length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, max - 1).trimEnd()}…`;
  return kept;
}

/** The site's mark: a lit screen and the heads of an audience. */
export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="12" fill={OG_COLORS.tile} />
      <rect {...SCREEN} fill={OG_COLORS.accent} />
      <circle cx={CUE.cx} cy={CUE.cy} r={CUE.r} fill="none" stroke={OG_COLORS.tile} strokeWidth={CUE.strokeWidth} />
      <g fill={OG_COLORS.tile}>{HEADS.map((d) => <path key={d} d={d} />)}</g>
    </svg>
  );
}
