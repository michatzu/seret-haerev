"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Caret } from "./Icons";

/**
 * Collapsed group whose content is only rendered (server-side) when open. The open state lives
 * in the URL (?kids=1 / ?far=1), so the page ships only what is on screen.
 */
export function LazyGroup({ label, count, param, open, children }: { label: string; count: number; param: string; open: boolean; children?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  if (!count) return null;
  const toggle = () => {
    const p = new URLSearchParams(sp.toString());
    if (open) p.delete(param);
    else p.set(param, "1");
    const s = p.toString();
    router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
  };
  return (
    <div className="flex flex-col gap-2.5">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex min-h-[48px] w-full items-center justify-between rounded-xl border border-line bg-card px-4 py-2 text-[15px] font-medium text-ink">
        <span>{label}</span>
        <span className="flex items-center gap-2 text-[13px] text-muted">
          <span>{count}</span>
          <Caret width={16} height={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <div className="flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}
