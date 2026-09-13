import type { ReactNode } from "react";
import { Caret } from "./Icons";

/** Collapsed group of cards ("לילדים ומדובבים", "מוקרן רחוק יותר"); native <details>, no JS. */
export function Group({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  if (!count) return null;
  return (
    <details className="group flex flex-col gap-2.5">
      <summary className="flex min-h-[48px] items-center justify-between rounded-xl border border-line bg-card px-4 py-2 text-[15px] font-medium text-ink">
        <span>{label}</span>
        <span className="flex items-center gap-2 text-[13px] text-muted">
          <span>{count}</span>
          <Caret width={16} height={16} className="chev transition-transform" />
        </span>
      </summary>
      <div className="flex flex-col gap-2.5 pt-2.5">{children}</div>
    </details>
  );
}
