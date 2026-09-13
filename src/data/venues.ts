import type { Venue } from "@/lib/types";

/**
 * Venue registry. Coordinates for Planet / Rav-Hen come from the chains' own API and are
 * refreshed on every scrape; the rest are curated (accurate to roughly 100-300 m).
 */
export const VENUES: Venue[] = [
  // ---- Planet (Cineworld, tenant 10100) ----
  { id: "planet-1025", chain: "planet", name: "פלאנט אילון", city: "רמת גן", address: "אבא הלל 301, קניון אילון", lat: 32.100334, lng: 34.826633, kind: "multiplex" },
  { id: "planet-1070", chain: "planet", name: "פלאנט חיפה", city: "חיפה", address: "ההסתדרות 55, קניון סינמול", lat: 32.79367, lng: 35.03827, kind: "multiplex" },
  { id: "planet-1072", chain: "planet", name: "פלאנט ראשון לציון", city: "ראשון לציון", address: "המאה ועשרים 4", lat: 31.97979, lng: 34.74759, kind: "multiplex" },
  { id: "planet-1073", chain: "planet", name: "פלאנט ירושלים", city: "ירושלים", address: "דרך חברון, מול מתחם התחנה", lat: 31.762255, lng: 35.22564, kind: "multiplex" },
  { id: "planet-1074", chain: "planet", name: "פלאנט באר שבע", city: "באר שבע", address: "ברוך קטינקא 2", lat: 31.22442, lng: 34.80144, kind: "multiplex" },
  { id: "planet-1075", chain: "planet", name: "פלאנט זכרון יעקב", city: "זכרון יעקב", address: "מרכז מסחרי מול זכרון", lat: 32.56926, lng: 34.933388, kind: "multiplex" },
  // ---- Rav-Hen (Cineworld, tenant 10104) ----
  { id: "ravhen-1058", chain: "ravhen", name: "רב חן גבעתיים", city: "גבעתיים", address: "דרך יצחק רבין 53, קניון גבעתיים", lat: 32.066593, lng: 34.81015, kind: "multiplex" },
  { id: "ravhen-1071", chain: "ravhen", name: "רב חן דיזנגוף", city: "תל אביב", address: "בן עמי 16, כיכר דיזנגוף", lat: 32.0782, lng: 34.77367, kind: "multiplex" },
  // ---- Cinema City (Modulus) ----
  { id: "cc-1170", chain: "cinemacity", name: "סינמה סיטי גלילות", city: "רמת השרון", address: "צומת גלילות", lat: 32.1478, lng: 34.804, kind: "multiplex" },
  { id: "cc-1173", chain: "cinemacity", name: "סינמה סיטי ראשון לציון", city: "ראשון לציון", address: "שדרות משה דיין 32", lat: 31.9884, lng: 34.7716, kind: "multiplex" },
  { id: "cc-1174", chain: "cinemacity", name: "סינמה סיטי ירושלים", city: "ירושלים", address: "שדרות יצחק רבין 10", lat: 31.7827, lng: 35.2018, kind: "multiplex" },
  { id: "cc-1175", chain: "cinemacity", name: "סינמה סיטי כפר סבא", city: "כפר סבא", address: "ויצמן 207, מתחם G", lat: 32.178, lng: 34.925, kind: "multiplex" },
  { id: "cc-1176", chain: "cinemacity", name: "סינמה סיטי נתניה", city: "נתניה", address: "המחקר 3, מתחם רוגובין", lat: 32.283, lng: 34.863, kind: "multiplex" },
  { id: "cc-1178", chain: "cinemacity", name: "סינמה סיטי באר שבע", city: "באר שבע", address: "החיטה 1", lat: 31.2449, lng: 34.806, kind: "multiplex" },
  { id: "cc-1181", chain: "cinemacity", name: "סינמה סיטי אשדוד", city: "אשדוד", address: "הרכבת 1", lat: 31.794, lng: 34.653, kind: "multiplex" },
  { id: "cc-1350", chain: "cinemacity", name: "סינמה סיטי חדרה", city: "חדרה", address: "צה״ל 35", lat: 32.439, lng: 34.923, kind: "multiplex" },
  // ---- Hot Cinema (Modulus) ----
  { id: "hot-1", chain: "hot", name: "הוט סינמה מודיעין", city: "מודיעין", address: "שדרות המלאכה 121, מרכז ישפרו", lat: 31.908, lng: 35.008, kind: "multiplex" },
  { id: "hot-2", chain: "hot", name: "הוט סינמה קריון", city: "קרית ביאליק", address: "דרך עכו 192", lat: 32.838, lng: 35.085, kind: "multiplex" },
  { id: "hot-5", chain: "hot", name: "הוט סינמה אשדוד", city: "אשדוד", address: "הגדוד העברי 6, קניון סי מול", lat: 31.794, lng: 34.642, kind: "multiplex" },
  { id: "hot-6", chain: "hot", name: "הוט סינמה נהריה", city: "נהריה", address: "האירית 2, קניון נהריה", lat: 33.008, lng: 35.098, kind: "multiplex" },
  { id: "hot-8", chain: "hot", name: "הוט סינמה אשקלון", city: "אשקלון", address: "הנמל 11", lat: 31.669, lng: 34.563, kind: "multiplex" },
  { id: "hot-9", chain: "hot", name: "הוט סינמה חיפה", city: "חיפה", address: "דרך שמחה גולן 54, גרנד קניון", lat: 32.792, lng: 35.01, kind: "multiplex" },
  { id: "hot-14", chain: "hot", name: "הוט סינמה פתח תקווה", city: "פתח תקווה", address: "ז׳בוטינסקי 72, הקניון הגדול", lat: 32.0918, lng: 34.86, kind: "multiplex" },
  { id: "hot-15", chain: "hot", name: "הוט סינמה כרמיאל", city: "כרמיאל", address: "מעלה כמון 5, קניון חוצות", lat: 32.921, lng: 35.302, kind: "multiplex" },
  { id: "hot-16", chain: "hot", name: "הוט סינמה כפר סבא", city: "כפר סבא", address: "עתיר ידע 4, מתחם אושילנד", lat: 32.164, lng: 34.931, kind: "multiplex" },
  { id: "hot-17", chain: "hot", name: "הוט סינמה רחובות", city: "רחובות", address: "ביל״ו 2, קניון עופר", lat: 31.897, lng: 34.808, kind: "multiplex" },
  { id: "hot-22", chain: "hot", name: "הוט סינמה DREAM STAGE חולון", city: "חולון", lat: 32.015, lng: 34.779, kind: "multiplex" },
  // ---- Movieland (Modulus) ----
  { id: "ml-1290", chain: "movieland", name: "מובילנד כרמיאל", city: "כרמיאל", address: "החרושת 15, מתחם גן העיר", lat: 32.916, lng: 35.299, kind: "multiplex" },
  { id: "ml-1291", chain: "movieland", name: "מובילנד חיפה", city: "חיפה", address: "משה פלימן 4, קניון עזריאלי", lat: 32.788, lng: 34.96, kind: "multiplex" },
  { id: "ml-1292", chain: "movieland", name: "מובילנד נתניה", city: "נתניה", address: "גיבורי ישראל 17, סנטר Y", lat: 32.284, lng: 34.86, kind: "multiplex" },
  { id: "ml-1293", chain: "movieland", name: "מובילנד הצוק", city: "תל אביב", address: "יוניצמן 21", lat: 32.1105, lng: 34.7983, kind: "multiplex" },
  { id: "ml-1294", chain: "movieland", name: "מובילנד עפולה", city: "עפולה", address: "יוסף ברזילי 5, קניון בלו וואלי", lat: 32.612, lng: 35.288, kind: "multiplex" },
  { id: "ml-1295", chain: "movieland", name: "Summer Sky עזריאלי", city: "תל אביב", address: "גג קניון עזריאלי", lat: 32.0745, lng: 34.792, kind: "outdoor" },
  { id: "ml-1296", chain: "movieland", name: "מובילנד בת ים", city: "בת ים", lat: 32.018, lng: 34.745, kind: "multiplex" },
  // ---- Cinematheques ----
  { id: "cinematheque-jlm", chain: "cinematheque", name: "סינמטק ירושלים", city: "ירושלים", address: "דרך חברון 11", lat: 31.7712, lng: 35.2255, kind: "cinematheque", url: "https://jer-cin.org.il" },
  { id: "cinematheque-ta", chain: "cinematheque", name: "סינמטק תל אביב", city: "תל אביב", address: "שפרינצק 2", lat: 32.0672, lng: 34.7832, kind: "cinematheque", url: "https://www.cinema.co.il" },
  { id: "cinematheque-haifa", chain: "cinematheque", name: "סינמטק חיפה", city: "חיפה", address: "שדרות הנשיא 142", lat: 32.8073, lng: 34.9866, kind: "cinematheque", url: "https://www.haifacin.co.il" },
  // ---- Lev ----
  { id: "lev-tlv", chain: "lev", name: "לב דיזנגוף", city: "תל אביב", address: "דיזנגוף 50, דיזנגוף סנטר", lat: 32.0753, lng: 34.7751, kind: "boutique" },
  { id: "lev-daniel", chain: "lev", name: "לב דניאל", city: "הרצליה", address: "מלון דניאל, הרצליה פיתוח", lat: 32.173, lng: 34.799, kind: "boutique" },
  { id: "lev-smadar", chain: "lev", name: "לב סמדר", city: "ירושלים", address: "לויד ג׳ורג׳ 4", lat: 31.766, lng: 35.22, kind: "boutique" },
  { id: "lev-omer", chain: "lev", name: "לב עומר", city: "עומר", lat: 31.268, lng: 34.849, kind: "boutique" },
  { id: "lev-raanana", chain: "lev", name: "לב רעננה", city: "רעננה", address: "אחוזה 267", lat: 32.184, lng: 34.871, kind: "boutique" },
  { id: "lev-even-yehuda", chain: "lev", name: "לב אבן יהודה", city: "אבן יהודה", address: "המייסדים 41", lat: 32.27, lng: 34.887, kind: "boutique" },
  { id: "lev-ramat-hasharon", chain: "lev", name: "לב רמת השרון", city: "רמת השרון", lat: 32.146, lng: 34.839, kind: "boutique" },
];

export const VENUE_BY_ID = new Map(VENUES.map((v) => [v.id, v]));

/** Lev's schedule endpoint is keyed by the branch's Hebrew name. */
export const LEV_BRANCHES: { loc: string; venueId: string }[] = [
  { loc: "לב תל אביב", venueId: "lev-tlv" },
  { loc: "לב דניאל", venueId: "lev-daniel" },
  { loc: "לב סמדר", venueId: "lev-smadar" },
  { loc: "לב עומר", venueId: "lev-omer" },
  { loc: "לב רעננה", venueId: "lev-raanana" },
  { loc: "לב אבן יהודה", venueId: "lev-even-yehuda" },
  { loc: "לב רמת השרון", venueId: "lev-ramat-hasharon" },
];
