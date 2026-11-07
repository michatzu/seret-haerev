import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "אודות",
  description: "סרט הערב מרכז את לוחות ההקרנה של כל בתי הקולנוע בישראל, כולל הסינמטקים, בתי הקולנוע העצמאיים ומקומות שמקרינים סרטים.",
  alternates: { canonical: "/about" },
};

/**
 * What the site is, where its information comes from, and the credits its sources ask for: TMDB
 * wants its notice and logo in an "about" or "credits" section, and less prominent than the site's
 * own mark; IMDb's non-commercial datasets ask for their statement.
 */
export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-5 px-4 py-8 text-[15px] leading-[1.7] text-ink">
      <h1 className="font-serif text-[26px] font-bold leading-tight">אודות</h1>
      <p>
        סרט הערב עונה על שאלה אחת: מה אפשר לראות היום, קרוב אליך. הוא מרכז במקום אחד את לוחות ההקרנה של בתי הקולנוע בישראל, מהרשתות ועד הסינמטקים, בתי הקולנוע העצמאיים ומקומות שמקרינים סרטים גם אם הם לא בתי קולנוע, וממיין אותם לפי שעה ומרחק.
      </p>
      <p>
        הלוחות נאספים כמה פעמים ביום מהאתרים הפומביים של בתי הקולנוע. לחיצה על שעת הקרנה מעבירה להזמנת כרטיסים באתר של בית הקולנוע, ושם המידע הקובע. האתר חינמי, בלי פרסומות ובלי הרשמה.
      </p>

      <h2 className="pt-2 font-serif text-[20px] font-bold leading-tight">קרדיטים</h2>
      <div className="flex flex-col gap-2.5">
        <p>כרזות, תקצירים, במאים, שחקנים ופרטי הסרטים מגיעים מהמאגר TMDB (The Movie Database).</p>
        <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="self-start" aria-label="The Movie Database (TMDB)">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tmdb.svg" alt="The Movie Database (TMDB)" width={110} height={14} className="h-3.5 w-auto" />
        </a>
        <p dir="ltr" className="text-start text-[13px] text-muted">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <p>דירוגי IMDb מגיעים מקובצי הנתונים ש-IMDb מעמידה לשימוש לא מסחרי.</p>
        <p dir="ltr" className="text-start text-[13px] text-muted">
          Information courtesy of IMDb (<a href="https://www.imdb.com" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted">https://www.imdb.com</a>). Used with permission.
        </p>
      </div>

      <div className="flex gap-4 pt-2">
        <Link href="/" className="text-[15px] font-medium text-accent">לכל הסרטים</Link>
        <Link href="/privacy" className="text-[15px] font-medium text-accent">פרטיות</Link>
      </div>
    </main>
  );
}
