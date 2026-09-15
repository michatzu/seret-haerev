import { formatTime } from "@/lib/format";
import { ymdInIsrael } from "@/lib/tz";

/**
 * How old the schedule is. A time alone reads as "just now", which is a promise this page should
 * only make when it is true, so anything not from today says the date instead.
 */
export function Freshness({ generatedAt, now }: { generatedAt: string; now: Date }) {
  const at = new Date(generatedAt);
  const today = ymdInIsrael(at) === ymdInIsrael(now);
  const hours = (now.getTime() - at.getTime()) / 3600_000;
  if (today && hours < 6) return <span>הלוחות עודכנו ב-{formatTime(generatedAt)}</span>;
  const [, m, d] = ymdInIsrael(at).split("-");
  return <span className="text-warn">הלוחות עודכנו ב-{Number(d)}.{Number(m)} בשעה {formatTime(generatedAt)}</span>;
}
