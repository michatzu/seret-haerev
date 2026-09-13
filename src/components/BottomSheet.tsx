"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
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
      <div className="relative w-full max-w-[520px] rounded-t-2xl bg-card px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_30px_rgba(16,24,40,0.18)]">
        <div className="mx-auto mb-1 h-1 w-9 rounded-full bg-line" />
        {title && <div className="px-0.5 pb-1 pt-2 text-[13px] text-muted">{title}</div>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SheetOption({ selected, onSelect, children, first }: { selected: boolean; onSelect: () => void; children: ReactNode; first?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-[50px] w-full items-center justify-between px-0.5 text-start text-[16px] text-ink ${selected ? "font-semibold" : "font-normal"} ${first ? "" : "border-t border-line"}`}
    >
      <span>{children}</span>
      {selected && <CheckMark />}
    </button>
  );
}

function CheckMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
