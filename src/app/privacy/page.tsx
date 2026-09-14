import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "פרטיות" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-5 px-4 py-8 text-[15px] leading-[1.7] text-ink">
      <h1 className="font-serif text-[26px] font-bold leading-tight">פרטיות</h1>
      <p>סרט הערב לא מזהה אותכם, לא דורש הרשמה ולא משתמש בכלי מעקב או בפרסום.</p>
      <p>
        האתר שומר במכשיר שלכם עוגייה אחת בלבד, בשם <code className="text-[13px]">loc</code>, ורק אחרי שבחרתם עיר או אישרתם מיקום מדויק. היא מחזיקה את המיקום שבחרתם כדי שהרשימה תיפתח עליו בפעם הבאה, ונשמרת עד שנה. מחיקת העוגייה בדפדפן מאפסת את הבחירה.
      </p>
      <p>
        רשימת ״צפיתי״ נשמרת אף היא במכשיר בלבד, באחסון המקומי של הדפדפן, ולא נשלחת לשום מקום. מחיקת נתוני האתר בדפדפן מוחקת אותה.
      </p>
      <p>כשלא בחרתם מיקום, העיר המשוערת נגזרת מכתובת האינטרנט של החיבור בזמן הבקשה, בלי לשמור אותה.</p>
      <p>המיקום המדויק, אם אישרתם אותו, נשאר במכשיר ובעוגייה בלבד. הוא לא נשלח לשום גורם אחר.</p>
      <p>לוחות ההקרנה נאספים מהאתרים הפומביים של בתי הקולנוע. לחיצה על שעת הקרנה מעבירה לאתר בית הקולנוע, ושם חלה מדיניות הפרטיות שלו.</p>
      <Link href="/" className="text-[15px] font-medium text-accent">חזרה לרשימה</Link>
    </main>
  );
}
