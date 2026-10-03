/**
 * The code that stands in for an account: four digits, chosen by whoever is keeping the list.
 *
 * There is nothing secret in a list of films, so this is not trying to be a password — it is
 * trying to be something you remember. Four digits are short enough that two people will
 * sometimes want the same ones, which is why saving says so rather than quietly joining them,
 * and why restoring only ever adds to what a browser already has. Nothing a code does can empty
 * a list; the worst a wrong one can do is put films in it that somebody else chose.
 */
const CODE_RE = /^(\d{4})$/;
/** The first codes were words and digits; those still have to work. */
const LEGACY_RE = /^([֐-׿]+(?:-[֐-׿]+){0,2})-(\d{3,4})$/;

/** The same code however it was typed: spaces, dashes, Arabic-Indic digits from a phone keypad. */
export function normalizeCode(input: string): string | null {
  const t = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s_–—]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const m = CODE_RE.exec(t.replace(/-/g, ""));
  if (m) return m[1];
  const old = LEGACY_RE.exec(t);
  return old ? `${old[1]}-${old[2]}` : null;
}
