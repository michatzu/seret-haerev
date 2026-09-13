# סרט הערב

מה מוקרן לידך היום, בכל בתי הקולנוע בישראל, במקום אחד. רשימה מינימליסטית של סרטים לפי קרבה, שעה ו-IMDb, ולחיצה על שעה פותחת ישירות את בחירת המושבים באתר בית הקולנוע.

## איך זה עובד

- `npm run scrape` — אוסף את כל ההקרנות מהרשתות (פלאנט, רב חן, סינמה סיטי, הוט סינמה, מובילנד, לב) ומהסינמטקים (תל אביב, ירושלים, חיפה), מאחד סרטים בין הרשתות, ומעשיר אותם מ-TMDB ו-OMDb אם יש מפתחות, ושומר ל-`data/snapshot.json`.
- `npm run dev` — האתר (Next.js, App Router). קורא את הקובץ ומחשב מרחקים מהמיקום של המשתמש.
- המיקום: עוגיית `loc` (נבחרת בכפתור המיקום), אחרת העיר לפי כתובת ה-IP (כותרות של Vercel), אחרת תל אביב.
- הסינון חי בכתובת: `?day=today|tomorrow|d2|d3|week&from=now|noon|evening|night|all&r=5|15|30|all&hall=all|imax|vip|4dx|cinematheque|outdoor&sort=dist|time|imdb`.

## מבנה

```
scripts/scrape.ts        הרצת כל המתאמים וכתיבת ה-snapshot
src/scraper/             מתאם לכל מקור (cineworld, modulus, lev, cinematheques), normalize, tmdb
src/data/venues.ts       בתי הקולנוע וקואורדינטות
src/lib/                 טיפוסים, זמן (Asia/Jerusalem), גיאוגרפיה, סינון ומיון (query.ts), טעינת נתונים
src/app/                 עמודים: / (הרשימה), /film/[id] (דף סרט)
src/components/          רכיבי UI
```

## הגדרות

העתיקו את `.env.example` ל-`.env.local`:

- `TMDB_API_KEY` — פוסטרים, תקצירים בעברית, מדינה, שנה, במאי ושחקנים ([themoviedb.org](https://www.themoviedb.org/settings/api), חינם).
- `OMDB_API_KEY` — ציון IMDb ([omdbapi.com](https://www.omdbapi.com/apikey.aspx), חינם עד 1,000 בקשות ביום).

בלי המפתחות האתר עובד, רק עם פחות מידע על הסרטים.
