import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <div className="font-serif text-[26px] font-bold text-ink">הדף לא נמצא</div>
      <Link href="/" className="text-[15px] font-medium text-accent">חזרה לרשימה</Link>
    </main>
  );
}
