import type { Screening } from "@/lib/types";
import { formatTime } from "@/lib/format";

/** A screening time that opens the chain's seat selection for that screening. */
export function TimePill({ s, tag, big = false, label }: { s?: Screening; tag?: string; big?: boolean; label?: string }) {
  const text = label ?? (s ? formatTime(s.startsAt) : "");
  const cls = `tabular inline-flex items-center gap-1.5 rounded-md bg-pill-bg font-semibold text-pill-ink ${big ? "h-[38px] px-3 text-[15px]" : "h-[26px] px-2 text-[13px]"}`;
  const inner = (
    <>
      <span>{text}</span>
      {tag && <span className={`font-medium text-pill-tag ${big ? "text-[12px]" : "text-[11px]"}`}>{tag}</span>}
    </>
  );
  if (!s) return <span className={cls}>{inner}</span>;
  return (
    <a href={s.bookingUrl} target="_blank" rel="noopener noreferrer" className={cls} title="לרכישת כרטיסים">
      {inner}
    </a>
  );
}

/** Tag text shown next to a time on the list (hall type or dubbing), if any. */
export function screeningTag(s: Screening): string | undefined {
  if (s.attrs.includes("imax")) return "IMAX";
  if (s.attrs.includes("4dx")) return "4DX";
  if (s.attrs.includes("screenx")) return "ScreenX";
  if (s.attrs.includes("vip")) return "VIP";
  if (s.attrs.includes("35mm")) return "35 מ״מ";
  if (s.attrs.includes("outdoor")) return "חוץ";
  if (s.dubbedLang === "ru") return "מדובב לרוסית";
  if (s.dubbedLang === "en") return "מדובב לאנגלית";
  if (s.attrs.includes("dubbed")) return "מדובב";
  if (s.attrs.includes("3d")) return "3D";
  return undefined;
}
