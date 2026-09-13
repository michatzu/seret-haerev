/** Title normalisation used to unify the same film across chains. */

const NOISE = [
  /\bg\s*kids\b/gi,
  /מדובבת?/g,
  /בעברית/g,
  /לעברית/g,
  /כתוביות/g,
  /\bimax\b/gi,
  /\b4dx\b/gi,
  /\bvip\b/gi,
  /\bscreenx\b/gi,
  /\b3d\b/gi,
  /\b2d\b/gi,
  /\batmos\b/gi,
  /הסרט$/g,
  /movieretro-?/gi,
  /infinity vision/gi,
  /\bkids\b/gi,
  /לרוסית|לעברית|לאנגלית|אנגלית|רוסית|מציגים/g,
];

export function normalizeTitle(raw: string): string {
  let s = raw.normalize("NFKC");
  // Russian-dubbed variants come as "ОДИССЕЯ - The Odyssey": keep the Latin part
  if (/[Ѐ-ӿ]/.test(s) && s.includes(" - ")) s = s.split(" - ").slice(1).join(" - ");
  s = s.toLowerCase();
  for (const re of NOISE) s = s.replace(re, " ");
  s = s
    .replace(/[״"'׳`’‘“”():!?.,\-–—_/\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

/** Short stable id from a string (djb2, base36). */
export function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function hasCyrillic(s: string): boolean {
  return /[Ѐ-ӿ]/.test(s);
}

export function containsAny(s: string, words: string[]): boolean {
  return words.some((w) => s.includes(w));
}
