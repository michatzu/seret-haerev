/**
 * The code that stands in for an account.
 *
 * One ordinary word and four digits — short enough to read off one phone and type into another,
 * and short enough to say out loud. There is nothing secret in a list of films, so this is not
 * trying to be a password. What it does have to survive is a typo: restoring a code merges what
 * it holds into this browser and then keeps that code up to date, so a mistyped code that happens
 * to belong to somebody else would quietly rewrite their list. The word is what makes that
 * essentially impossible — four digits alone would land on a real code every time.
 */
const WORDS = [
  "אבטיח", "אגוז", "אגם", "אורן", "אריה", "ארנב", "בוקר", "בלון", "במה", "ברווז",
  "גג", "גזר", "גיטרה", "גלגל", "גמל", "גן", "גשם", "דבש", "דגל", "דלת",
  "דרור", "הר", "ורד", "זברה", "זית", "חוף", "חולית", "חלון", "חלב", "חתול",
  "טווס", "טיול", "ים", "יונה", "ירח", "כביש", "כוכב", "כינור", "כלב", "כרמל",
  "לבנה", "לימון", "לוויתן", "מגדל", "מזרקה", "מטוס", "מלפפון", "מנגו", "מפרש", "מראה",
  "נהר", "נחליאלי", "נמר", "נעל", "סוס", "סירה", "סלע", "ספר", "סתיו", "עגורן",
  "עדשה", "עוגה", "עיפרון", "עלה", "ענן", "עפיפון", "ערמון", "פטרייה", "פילון", "פנס",
  "פסנתר", "פרח", "צבי", "צדף", "צוק", "ציפור", "צל", "קיפוד", "קיץ", "קמח",
  "קפה", "קרח", "קשת", "ראי", "רימון", "רכבת", "רעם", "שביל", "שדה", "שומר",
  "שועל", "שחף", "שיר", "שלג", "שמש", "שעון", "שקד", "תאנה", "תוכי", "תות",
  "תיבה", "תמר", "תנור", "תפוז", "תפוח", "תרנגול", "אבן", "אגס", "אדמה", "אוהל",
  "אופק", "אור", "איל", "אלון", "אפרסק", "ארמון", "בוסתן", "בז", "ביצה", "בית",
  "בלוט", "בננה", "בצל", "ברק", "גבעה", "גדר", "גורילה", "גיר",
];

const CODE_RE = /^([֐-׿]+)-(\d{4})$/;
/** The first codes were three words and three digits; those still have to work. */
const LEGACY_RE = /^([֐-׿]+)-([֐-׿]+)-([֐-׿]+)-(\d{3})$/;

export function makeCode(random: () => number = Math.random): string {
  const word = WORDS[Math.floor(random() * WORDS.length)];
  const digits = String(Math.floor(random() * 10000)).padStart(4, "0");
  return `${word}-${digits}`;
}

/** The same code however it was typed: spaces for hyphens, stray spaces, a different dash. */
export function normalizeCode(input: string): string | null {
  const t = input.trim().replace(/[\s_–—]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const m = CODE_RE.exec(t);
  if (m) return WORDS.includes(m[1]) ? `${m[1]}-${m[2]}` : null;
  const old = LEGACY_RE.exec(t);
  if (!old) return null;
  const words = [old[1], old[2], old[3]];
  return words.every((w) => WORDS.includes(w)) ? `${words.join("-")}-${old[4]}` : null;
}
