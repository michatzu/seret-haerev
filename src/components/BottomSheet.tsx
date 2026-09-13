"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check } from "./Icons";

export function BottomSheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="סגירה" onClick={onClose} className="absolute inset-0 bg-[var(--overlay)]" />
      <div className="relative flex max-h-[85vh] w-full max-w-[520px] flex-col rounded-t-2xl bg-card px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_30px_rgba(16,24,40,0.18)]">
        <div className="mx-auto mb-1 h-1 w-9 shrink-0 rounded-full bg-line" />
        {title && <div className="shrink-0 px-0.5 pb-1 pt-2 text-[13px] text-muted">{title}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="shrink-0 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Single-choice row: the selected one carries a check mark. */
export function SheetOption({ selected, onSelect, children, first, hint }: { selected: boolean; onSelect: () => void; children: ReactNode; first?: boolean; hint?: ReactNode }) {
  return (
    <button type="button" onClick={onSelect} className={`flex min-h-[50px] w-full items-center justify-between gap-3 px-0.5 text-start text-[16px] text-ink ${selected ? "font-semibold" : "font-normal"} ${first ? "" : "border-t border-line"}`}>
      <span className="flex min-w-0 items-baseline gap-2"><span className="truncate">{children}</span>{hint && <span className="shrink-0 text-[13px] font-normal text-muted">{hint}</span>}</span>
      {selected && <Check width={20} height={20} className="shrink-0 text-accent" />}
    </button>
  );
}

/** Multi-choice row: a small square that fills when checked. */
export function CheckOption({ checked, onToggle, children, first, hint }: { checked: boolean; onToggle: () => void; children: ReactNode; first?: boolean; hint?: ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onToggle} className={`flex min-h-[50px] w-full items-center justify-between gap-3 px-0.5 text-start text-[16px] text-ink ${checked ? "font-semibold" : "font-normal"} ${first ? "" : "border-t border-line"}`}>
      <span className="flex min-w-0 items-baseline gap-2"><span className="truncate">{children}</span>{hint && <span className="shrink-0 text-[13px] font-normal text-muted">{hint}</span>}</span>
      <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border ${checked ? "border-accent bg-accent text-accent-ink" : "border-line"}`} aria-hidden>
        {checked && <Check width={15} height={15} />}
      </span>
    </button>
  );
}

export function DoneButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink">סיום</button>
  );
}
