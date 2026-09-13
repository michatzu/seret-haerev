# סרט הערב

מה מוקרן לידך היום, בכל בתי הקולנוע בישראל, במקום אחד. רשימה מינימליסטית של סרטים לפי קרבה, שעה ו-IMDb, ולחיצה על שעה פותחת ישירות את בחירת המושבים באתר בית הקולנוע.

## איך זה עובד

- `npm run scrape` — אוסף את כל ההקרנות מהרשתות (פלאנט, רב חן, סינמה סיטי, הוט סינמה, מובילנד, לב) ומהסינמטקים (תל אביב, ירושלים, חיפה), מאחד סרטים בין הרשתות, מעשיר אותם מ-TMDB אם יש מפתח ומוסיף ציוני IMDb מהמאגר הרשמי, ושומר ל-`data/snapshot.json`.
- `npm run dev` — האתר (Next.js, App Router). קורא את הקובץ ומחשב מרחקים מהמיקום של המשתמש.
- המיקום: עוגיית `loc` (נבחרת בכפתור המיקום), אחרת העיר לפי כתובת ה-IP (כותרות של Vercel), אחרת תל אביב.
- הסינון חי בכתובת: `?day=today|tomorrow|d2|d3|week&from=now|noon,evening|all&r=5|15|30|all&hall=imax,vip,4dx,screenx,3d,cinematheque,outdoor&v=<venue ids>&g=<genre keys>&sort=dist|time|imdb&kids=1&far=1`.

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
- ציון IMDb מגיע ישירות ממאגר הנתונים היומי של IMDb (title.ratings), בלי מפתח; צריך רק את מזהה ה-IMDb שמגיע מ-TMDB.

בלי המפתחות האתר עובד, רק עם פחות מידע על הסרטים.
