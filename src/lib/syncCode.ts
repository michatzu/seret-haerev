/**
 * The code that stands in for an account.
 *
 * Three ordinary words and three digits, which is something a person can read off one phone and
 * type into another without writing it down wrong. There is no name and no password behind it:
 * the code is the whole of it, which is also why it has to be long enough that nobody stumbles
 * into somebody else's — a hundred and twenty-eight words cubed, times a thousand, is about two
 * billion of them.
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

const CODE_RE = /^([֐-׿]+)-([֐-׿]+)-([֐-׿]+)-(\d{3})$/;

export function makeCode(random: () => number = Math.random): string {
  const pick = () => WORDS[Math.floor(random() * WORDS.length)];
  const digits = String(Math.floor(random() * 1000)).padStart(3, "0");
  return `${pick()}-${pick()}-${pick()}-${digits}`;
}

/** The same code however it was typed: spaces for hyphens, stray spaces, a different dash. */
export function normalizeCode(input: string): string | null {
  const t = input.trim().replace(/[\s_–—]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const m = CODE_RE.exec(t);
  if (!m) return null;
  const words = [m[1], m[2], m[3]];
  if (!words.every((w) => WORDS.includes(w))) return null;
  return `${words.join("-")}-${m[4]}`;
}
